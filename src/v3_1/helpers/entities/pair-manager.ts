import { EthereumBlock } from "@subql/types-ethereum";
import { PairManager } from "../../../types";
import { Hypervisor__factory } from "../../../types/contracts/factories/Hypervisor__factory";
import { Totals__factory } from "../../../types/contracts/factories/Totals__factory";
import { getOrCreateToken } from "../../../common/helpers/entities/token";
import { getOrCreateDeploymentInfo } from "../../../common/helpers/entities/deployment-info";
import {
  createPairManager,
  updatePairManagerAmounts,
} from "../../../common/helpers/entities/pair-manager";

// api is provided by SubQuery runtime
declare const api: any;

export async function getOrCreatePairManager(pmAddress: string): Promise<PairManager> {
  let entity = await PairManager.get(pmAddress);
  if (!entity) {
    const pmContract = Hypervisor__factory.connect(pmAddress, api);

    entity = await createPairManager(pmAddress);
    
    entity.name = await pmContract.name();
    entity.symbol = await pmContract.symbol();
    entity.decimals = await pmContract.decimals();
    const totalSupply = await pmContract.totalSupply();
    entity.totalSupply = BigInt(totalSupply.toString());
    entity.fee = await pmContract.fee();

    const token0Address = await pmContract.token0();
    const token1Address = await pmContract.token1();
    
    const token0 = await getOrCreateToken(token0Address);
    const token1 = await getOrCreateToken(token1Address);

    entity.token0Id = token0.id;
    entity.token1Id = token1.id;

    await entity.save();
  }
  return entity;
}

export async function updateAmountsWithCall(
  pmAddress: string,
  block: EthereumBlock
): Promise<PairManager | undefined> {
  let pm = await PairManager.get(pmAddress);
  
  if (!pm || !pm.active) {
    return pm;
  }

  const deploymentInfo = await getOrCreateDeploymentInfo();
  
  try {
    const pmContract = Hypervisor__factory.connect(pmAddress, api);
    const tick = await pmContract.currentTick();

    // Only update tick if totals contract is not available yet
    if (BigInt(block.number.toString()) < deploymentInfo.getTotalsContractStartBlock) {
      pm = await updatePairManagerAmounts(
        pmAddress,
        tick,
        pm.tvl0,
        pm.tvl1,
        pm.uncollectedFees0,
        pm.uncollectedFees1,
        block
      );
      return pm;
    }

    const totalsContract = Totals__factory.connect(
      deploymentInfo.getTotalsContract,
      api
    );

    const totalAmounts = await totalsContract.getTotalAmounts(
      deploymentInfo.poolVersion,
      pmAddress,
      deploymentInfo.feeCalcMethod === "oneOverFees"
    );

    pm = await updatePairManagerAmounts(
      pmAddress,
      tick,
      BigInt(totalAmounts.total0.toString()),
      BigInt(totalAmounts.total1.toString()),
      BigInt(totalAmounts.fees0.toString()),
      BigInt(totalAmounts.fees1.toString()),
      block
    );
  } catch (error) {
    logger.warn(`getTotalAmounts failed for ${pmAddress}: ${error}`);
  }

  return pm;
}

export async function isValidPairManager(pmAddress: string): Promise<boolean> {
  try {
    const pmContract = Hypervisor__factory.connect(pmAddress, api);
    
    // Check if the contract is a valid PairManager
    await pmContract.getTotalAmounts();
    return true;
  } catch (error) {
    logger.warn(`Invalid hypervisor/mpm: ${pmAddress}`);
    return false;
  }
}