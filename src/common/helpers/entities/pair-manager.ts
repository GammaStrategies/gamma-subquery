import { EthereumBlock } from "@subql/types-ethereum";
import { PairManager } from "../../../types";
import { SnapshotType } from "../../../types/enums";
import { createPairManagerDatasource } from "../../../types";
import { ZERO_ADDRESS, ZERO_BD, ZERO_BI } from "../../config/constants";
import { getOrCreateDeploymentInfo } from "./deployment-info";
import { getOrCreateFeeSnapshot } from "./fee-snapshot";
import { createPairManagerReturn } from "./pair-manager-returns";
import { totalAmountInToken1 } from "../token-exchange";

export async function createPairManager(pmAddress: string): Promise<PairManager> {
  let entity = await PairManager.get(pmAddress);
  if (!entity) {
    entity = PairManager.create({
      id: pmAddress,
      deploymentId: "0",
      name: "",
      symbol: "",
      decimals: 0,
      totalSupply: ZERO_BI,
      fee: 0,
      tick: 0,
      token0Id: ZERO_ADDRESS,
      token1Id: ZERO_ADDRESS,
      tvl0: ZERO_BI,
      tvl1: ZERO_BI,
      tvlTotalInToken1: ZERO_BD,
      totalFees0: ZERO_BI,
      totalFees1: ZERO_BI,
      totalFeesTotalInToken1: ZERO_BD,
      uncollectedFees0: ZERO_BI,
      uncollectedFees1: ZERO_BI,
      uncollectedFeesTotalInToken1: ZERO_BD,
      feeSnapshotLatestId: "",
      feeSnapshotHourlyLatestId: "",
      feeReturnId: pmAddress,
      active: true,
      _lastUpdatedBlock: ZERO_BI,
      _lastUpdatedTimestamp: ZERO_BI,
      _previousTvlTotalInToken1: ZERO_BD
    });

    const deployment = await getOrCreateDeploymentInfo();
    deployment.totalPairCount++;
    deployment.activePairCount++;
    await deployment.save();

    // Create dynamic datasource for this PairManager
    await createPairManagerDatasource({ address: pmAddress });

    // Create initial fee snapshot
    const initialSnapshot = await getOrCreateFeeSnapshot(
      pmAddress,
      SnapshotType.INITIAL,
      ZERO_BI,
      ZERO_BI
    );
    entity.feeSnapshotLatestId = initialSnapshot.id;
    entity.feeSnapshotHourlyLatestId = initialSnapshot.id;

    // Create PairManagerReturn entity
    await createPairManagerReturn(pmAddress);
  }
  return entity;
}

export async function updatePairManagerAmounts(
  pmAddress: string,
  tick: number,
  tvl0: bigint,
  tvl1: bigint,
  uncollectedFees0: bigint,
  uncollectedFees1: bigint,
  block: EthereumBlock
): Promise<PairManager> {
  const pm = await PairManager.get(pmAddress);
  
  if (!pm) {
    throw new Error(`PairManager ${pmAddress} not found`);
  }

  // Store previous TVL before updating (match original)
  pm._previousTvlTotalInToken1 = pm.tvlTotalInToken1;
  
  pm.tick = tick;
  pm.tvl0 = tvl0;
  pm.tvl1 = tvl1;
  pm.tvlTotalInToken1 = totalAmountInToken1(tvl0, tvl1, pm.tick);
  
  pm.uncollectedFees0 = uncollectedFees0;
  pm.uncollectedFees1 = uncollectedFees1;
  pm.uncollectedFeesTotalInToken1 = totalAmountInToken1(
    uncollectedFees0,
    uncollectedFees1,
    pm.tick
  );

  pm._lastUpdatedBlock = BigInt(block.number);
  pm._lastUpdatedTimestamp = BigInt(block.timestamp);

  await pm.save();
  return pm;
}