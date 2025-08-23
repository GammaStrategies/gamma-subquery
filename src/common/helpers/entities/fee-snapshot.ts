import { EthereumBlock } from "@subql/types-ethereum";
import { FeeSnapshot, PairManager } from "../../../types";
import { SnapshotType } from "../../../types/enums";
import { ONE_BD, ZERO_BD, ZERO_BI } from "../../config/constants";
import { totalAmountInToken1 } from "../token-exchange";

export async function getOrCreateFeeSnapshot(
  pmAddress: string,
  snapshotType: SnapshotType,
  blockNumber: bigint,
  blockTimestamp: bigint
): Promise<FeeSnapshot> {
  const snapshotId = `${pmAddress}-${blockNumber}`;
  let snapshot = await FeeSnapshot.get(snapshotId);
  
  if (!snapshot) {
    snapshot = FeeSnapshot.create({
      id: snapshotId,
      pairManagerId: pmAddress,
      type: snapshotType,
      blockNumber: blockNumber,
      blockTimestamp: blockTimestamp,
      tvl0: ZERO_BI,
      tvl1: ZERO_BI,
      tvlTotalInToken1: ZERO_BD,
      fee0: ZERO_BI,
      fee1: ZERO_BI,
      feeTotalInToken1: ZERO_BD,
      feeIncrementInToken1: ZERO_BD,
      yieldIncrement: ZERO_BD,
      cumulativeYield: ZERO_BD,
      _feeIncrementAdjustment: ZERO_BD,
      _previousCumulativeYield: ZERO_BD
    });
    await snapshot.save();
  }
  
  return snapshot;
}

export async function takeFeeSnapshot(
  pmAddress: string,
  snapshotType: SnapshotType,
  block: EthereumBlock,
  amount0: bigint,
  amount1: bigint
): Promise<FeeSnapshot> {
  const pm = await PairManager.get(pmAddress);
  if (!pm) {
    throw new Error(`PairManager ${pmAddress} not found`);
  }

  const lastSnapshot = pm.feeSnapshotLatestId ? await FeeSnapshot.get(pm.feeSnapshotLatestId) : null;

  if (snapshotType === SnapshotType.HOURLY && lastSnapshot && lastSnapshot.blockNumber === BigInt(block.number.toString())) {
    // If snapshot already exists for this block, no need for hourly
    return lastSnapshot;
  }

  const snapshot = await getOrCreateFeeSnapshot(
    pmAddress,
    snapshotType,
    BigInt(block.number.toString()),
    BigInt(block.timestamp.toString())
  );

  // Set TVL values from PairManager
  snapshot.tvl0 = pm.tvl0;
  snapshot.tvl1 = pm.tvl1;
  snapshot.tvlTotalInToken1 = pm._previousTvlTotalInToken1;

  // Handle cumulative yield tracking
  if (lastSnapshot && lastSnapshot.id !== snapshot.id) {
    snapshot._previousCumulativeYield = lastSnapshot.cumulativeYield;
    if (lastSnapshot.type === SnapshotType.HOURLY) {
      // If the previous one is hourly we keep track of the adjustment amount
      snapshot._feeIncrementAdjustment = lastSnapshot.feeTotalInToken1;
    }
  }

  // Calculate new fee amounts
  const fee0 = snapshot.fee0 + amount0;
  const fee1 = snapshot.fee1 + amount1;

  snapshot.fee0 = fee0;
  snapshot.fee1 = fee1;
  
  // Calculate fee total in token1 using the PM's tick
  snapshot.feeTotalInToken1 = totalAmountInToken1(fee0, fee1, pm.tick);
  
  // Calculate fee increment
  if (snapshot.feeTotalInToken1 > snapshot._feeIncrementAdjustment) {
    snapshot.feeIncrementInToken1 = snapshot.feeTotalInToken1 - snapshot._feeIncrementAdjustment;
  } else {
    snapshot.feeIncrementInToken1 = ZERO_BD;
  }

  // Calculate yield increment
  if (snapshot.tvlTotalInToken1 > ZERO_BD) {
    snapshot.yieldIncrement = snapshot.feeIncrementInToken1 / snapshot.tvlTotalInToken1;
  }

  // Calculate cumulative yield using compound formula
  // cumulativeYield = (1 + previousCumulativeYield) * (1 + yieldIncrement) - 1
  snapshot.cumulativeYield = (ONE_BD + snapshot._previousCumulativeYield) * 
                             (ONE_BD + snapshot.yieldIncrement) - ONE_BD;

  await snapshot.save();

  return snapshot;
}