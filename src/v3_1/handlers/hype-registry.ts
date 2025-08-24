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
  logger.warn(`Attempting to add PairManager: ${hypeAddress}`);
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
  logger.warn(`[handle1h] Starting hourly snapshot handler at block ${block.number}`);
  
  // Periodically take snapshot of outstanding fees
  const deployment = await getOrCreateDeploymentInfo();
  logger.warn(`[handle1h] DeploymentInfo - getTotalsContractStartBlock: ${deployment.getTotalsContractStartBlock}`);
  
  if (BigInt(block.number) < deployment.getTotalsContractStartBlock) {
    // There is no point taking hourly snapshots if we can't get the amounts
    logger.warn(`[handle1h] Skipping - block ${block.number} < totals contract start block ${deployment.getTotalsContractStartBlock}`);
    return;
  }
  
  // Get all active PairManagers
  // Note: In SubQuery, we need to query all PairManagers and filter for active ones
  const allPairManagers = await PairManager.getByActive(true, { limit: 80 });
  logger.warn(`[handle1h] Found ${allPairManagers.length} active PairManagers`);
  
  // Loop through all PairManagers, run get totalAmounts and update uncollected fees
  for (const pm of allPairManagers) {
    const pmAddress = pm.id;
    logger.warn(`[handle1h] Processing PairManager ${pmAddress}`);
    
    const updatedPm = await updateAmountsWithCall(pmAddress, block);
    
    if (!updatedPm) {
      logger.warn(`[handle1h] updateAmountsWithCall returned undefined for ${pmAddress}`);
      continue;
    }
    
    if (!updatedPm.active) {
      logger.warn(`[handle1h] PairManager ${pmAddress} is not active after update, skipping snapshot`);
      continue;
    }
    
    logger.warn(`[handle1h] PairManager ${pmAddress} updated successfully, taking fee snapshot`);
    
    const snapshot = await takeFeeSnapshot(
      pmAddress,
      SnapshotType.HOURLY,
      block,
      updatedPm.uncollectedFees0,
      updatedPm.uncollectedFees1
    );
    logger.warn(`[handle1h] Created fee snapshot ${snapshot.id} for ${pmAddress} with fees0: ${updatedPm.uncollectedFees0}, fees1: ${updatedPm.uncollectedFees1}`);

    await snapshot.save();
    logger.warn(`[handle1h] Saved snapshot for ${pmAddress}`);

    updatedPm.feeSnapshotLatestId = snapshot.id;
    updatedPm.feeSnapshotHourlyLatestId = snapshot.id;
    await updatedPm.save();
    logger.warn(`[handle1h] Updated PairManager ${pmAddress} with latest snapshot ID`);

    await updatePairManagerReturn(pmAddress);
  }
  
  logger.warn(`[handle1h] Completed hourly snapshot handler at block ${block.number}`);
}
