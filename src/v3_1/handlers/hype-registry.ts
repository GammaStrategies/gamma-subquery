import { EthereumLog, EthereumBlock } from "@subql/types-ethereum";
import { PairManager } from "../../types";
import { SnapshotType } from "../../types/enums";
import { getOrCreateDeploymentInfo } from "../../common/helpers/entities/deployment-info";
import { takeFeeSnapshot } from "../../common/helpers/entities/fee-snapshot";
import { updatePairManagerReturn } from "../../common/helpers/entities/pair-manager-returns";
import {
  getOrCreatePairManager,
  isValidPairManager,
  updateAmountsWithCall,
} from "../helpers/entities/pair-manager";
import { initializePairManagers } from "../helpers/hype-registry";

export async function handleHypeAdded(log: EthereumLog): Promise<void> {
  // Add new hype/mpm
  const hypeAddress = log.args?.hype as string;
  logger.info(`Attempting to add PairManager: ${hypeAddress}`);
  if (!(await isValidPairManager(hypeAddress))) {
    return;
  }
  await getOrCreatePairManager(hypeAddress);
}

export async function handleHypeRemoved(log: EthereumLog): Promise<void> {
  // Remove hype/mpm
  const hypeAddress = log.args?.hype as string;
  const pairManager = await PairManager.get(hypeAddress);
  if (pairManager) {
    pairManager.active = false;
    await pairManager.save();

    // Remove from deployment info
    const deployment = await getOrCreateDeploymentInfo();
    deployment.activePairCount -= 1;
    await deployment.save();
  }
}

export async function handleOnce(block: EthereumBlock): Promise<void> {
  // Setup Deployment Info
  logger.info("Initializing deployment info");
  await getOrCreateDeploymentInfo();
  // Loop through all hypes in registry and create entities
  // The registry address is hardcoded as per the project configuration
  const registryAddress = "0x2A078554094f5e342B69E5b6D3665507283EfBa1";
  await initializePairManagers(registryAddress);
  logger.info("PairManagers initialized from HypeRegistry");
}

export async function handle1h(block: EthereumBlock): Promise<void> {
  // Periodically take snapshot of outstanding fees
  const deployment = await getOrCreateDeploymentInfo();
  if (BigInt(block.number) < deployment.getTotalsContractStartBlock) {
    // There is no point taking hourly snapshots if we can't get the amounts
    return;
  }
  
  // Get all active PairManagers
  // Note: In SubQuery, we need to query all PairManagers and filter for active ones
  const allPairManagers = await PairManager.getByActive(true, { limit: 1000 });
  // Loop through all PairManagers, run get totalAmounts and update uncollected fees
  for (const pm of allPairManagers) {
    const pmAddress = pm.id;
    const updatedPm = await updateAmountsWithCall(pmAddress, block);
    if (!updatedPm || !updatedPm.active) {
      continue;
    }
    
    const snapshot = await takeFeeSnapshot(
      pmAddress,
      SnapshotType.HOURLY,
      block,
      updatedPm.uncollectedFees0,
      updatedPm.uncollectedFees1
    );

    await snapshot.save();

    updatedPm.feeSnapshotLatestId = snapshot.id;
    updatedPm.feeSnapshotHourlyLatestId = snapshot.id;
    await updatedPm.save();

    await updatePairManagerReturn(pmAddress);
  }
}
