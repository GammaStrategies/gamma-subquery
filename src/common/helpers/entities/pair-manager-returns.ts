import { PairManagerReturn, FeeSnapshot, PairManager } from "../../../types";
import { SnapshotType } from "../../../types/enums";
import { DAY_SECONDS, ONE_BD, YEAR_SECONDS, ZERO_BD, ZERO_BI } from "../../config/constants";
import { bigDecimalPower } from "../utils";
import { getOrCreateDeploymentInfo } from "./deployment-info";
import { getOrCreateFeeSnapshot } from "./fee-snapshot";

export async function createPairManagerReturn(pmAddress: string): Promise<PairManagerReturn> {
  const id = pmAddress;
  let pmr = await PairManagerReturn.get(id);
  
  if (!pmr) {
    const initialSnapshot = await getOrCreateFeeSnapshot(
      pmAddress,
      SnapshotType.INITIAL,
      ZERO_BI,
      ZERO_BI
    );

    pmr = PairManagerReturn.create({
      id,
      blockNumber: ZERO_BI,
      blockTimestamp: ZERO_BI,
      apr1: ZERO_BD,
      apy1: ZERO_BD,
      apr7: ZERO_BD,
      apy7: ZERO_BD,
      apr30: ZERO_BD,
      apy30: ZERO_BD,
      _snapshot1Id: initialSnapshot.id,
      _snapshot7Id: initialSnapshot.id,
      _snapshot30Id: initialSnapshot.id
    });
    await pmr.save();
  }
  
  return pmr;
}

export async function updatePairManagerReturn(pmAddress: string): Promise<void> {
  const deploymentInfo = await getOrCreateDeploymentInfo();
  const pm = await PairManager.get(pmAddress);
  
  if (!pm) {
    logger.warning(`Could not load PairManager ${pmAddress}`);
    return;
  }

  const snapshotLatest = pm.feeSnapshotLatestId ? await FeeSnapshot.get(pm.feeSnapshotLatestId) : null;
  const snapshotHourlyLatest = pm.feeSnapshotHourlyLatestId ? await FeeSnapshot.get(pm.feeSnapshotHourlyLatestId) : null;

  if (!snapshotLatest || !snapshotHourlyLatest) {
    logger.warning(`Could not load snapshots ${pm.feeSnapshotLatestId}, ${pm.feeSnapshotHourlyLatestId}`);
    return;
  }

  const latestBlock = snapshotHourlyLatest.blockNumber;
  const blocks1d = 24n * deploymentInfo.blocks1h;
  const block1d = latestBlock - blocks1d;
  const block7d = latestBlock - (blocks1d * 7n);
  const block30d = latestBlock - (blocks1d * 30n);

  // Load snapshots at specific block heights (match original implementation)
  const snapshot1d = await FeeSnapshot.get(`${pmAddress}-${block1d}`);
  const snapshot7d = await FeeSnapshot.get(`${pmAddress}-${block7d}`);
  const snapshot30d = await FeeSnapshot.get(`${pmAddress}-${block30d}`);

  // Match original: always create new entity (overwrites existing)
  const pmr = PairManagerReturn.create({
    id: pmAddress,
    blockNumber: latestBlock,
    blockTimestamp: snapshotHourlyLatest.blockTimestamp,
    apr1: ZERO_BD,
    apy1: ZERO_BD,
    apr7: ZERO_BD,
    apy7: ZERO_BD,
    apr30: ZERO_BD,
    apy30: ZERO_BD,
    _snapshot1Id: snapshotHourlyLatest.id,
    _snapshot7Id: snapshotHourlyLatest.id,
    _snapshot30Id: snapshotHourlyLatest.id
  });

  // Calculate 1-day returns
  if (snapshot1d) {
    pmr.apr1 = calculateApr(
      snapshotLatest.cumulativeYield,
      snapshot1d.cumulativeYield,
      snapshotLatest.blockTimestamp - snapshot1d.blockTimestamp
    );
    pmr.apy1 = calculateApy(
      snapshotLatest.cumulativeYield,
      snapshot1d.cumulativeYield,
      snapshotLatest.blockTimestamp - snapshot1d.blockTimestamp
    );
    pmr._snapshot1Id = snapshot1d.id;
  } else {
    pmr.apr1 = ZERO_BD;
    pmr.apy1 = ZERO_BD;
    pmr._snapshot1Id = snapshotHourlyLatest.id;
  }

  // Calculate 7-day returns
  if (snapshot7d) {
    pmr.apr7 = calculateApr(
      snapshotLatest.cumulativeYield,
      snapshot7d.cumulativeYield,
      snapshotLatest.blockTimestamp - snapshot7d.blockTimestamp
    );
    pmr.apy7 = calculateApy(
      snapshotLatest.cumulativeYield,
      snapshot7d.cumulativeYield,
      snapshotLatest.blockTimestamp - snapshot7d.blockTimestamp
    );
    pmr._snapshot7Id = snapshot7d.id;
  } else {
    pmr.apr7 = pmr.apr1;
    pmr.apy7 = pmr.apy1;
    pmr._snapshot7Id = pmr._snapshot1Id;
  }

  // Calculate 30-day returns
  if (snapshot30d) {
    pmr.apr30 = calculateApr(
      snapshotLatest.cumulativeYield,
      snapshot30d.cumulativeYield,
      snapshotLatest.blockTimestamp - snapshot30d.blockTimestamp
    );
    pmr.apy30 = calculateApy(
      snapshotLatest.cumulativeYield,
      snapshot30d.cumulativeYield,
      snapshotLatest.blockTimestamp - snapshot30d.blockTimestamp
    );
    pmr._snapshot30Id = snapshot30d.id;
  } else {
    pmr.apr30 = pmr.apr7;
    pmr.apy30 = pmr.apy7;
    pmr._snapshot30Id = pmr._snapshot7Id;
  }

  await pmr.save();
}

export function calculateApr(
  cumulativeYieldLatest: number,
  cumulativeYieldInitial: number,
  timePeriodSeconds: bigint
): number {
  // Calculate yield increment
  const yieldIncrement = (ONE_BD + cumulativeYieldLatest) / 
                         (ONE_BD + cumulativeYieldInitial) - ONE_BD;

  // Calculate annualized rate
  let timeFactor = ZERO_BD;
  if (timePeriodSeconds > ZERO_BI) {
    timeFactor = YEAR_SECONDS / Number(timePeriodSeconds);
  }

  return yieldIncrement * timeFactor;
}

export function calculateApy(
  cumulativeYieldLatest: number,
  cumulativeYieldInitial: number,
  timePeriodSeconds: bigint
): number {
  // Calculate yield increment
  const yieldIncrement = (ONE_BD + cumulativeYieldLatest) / 
                         (ONE_BD + cumulativeYieldInitial) - ONE_BD;

  // Calculate daily compounding factor
  let timeFactor = ZERO_BD;
  if (timePeriodSeconds > ZERO_BI) {
    timeFactor = DAY_SECONDS / Number(timePeriodSeconds);
  }

  // Calculate APY using compound interest formula
  // APY = (1 + dailyYield)^365 - 1
  const base = ONE_BD + (yieldIncrement * timeFactor);
  return bigDecimalPower(base, 365) - ONE_BD;
}