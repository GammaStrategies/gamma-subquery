import { EthereumBlock } from "@subql/types-ethereum";
import { PairManager } from "../../types";
import { SnapshotType } from "../../types/enums";
import { ZERO_BD, ZERO_BI } from "../config/constants";
import { takeFeeSnapshot } from "../helpers/entities/fee-snapshot";
import { amount0InToken1 } from "../helpers/token-exchange";
import { updatePairManagerReturn } from "../helpers/entities/pair-manager-returns";
import { calcNetFees } from "../helpers/fees";

export async function processZeroBurn(
  pmAddress: string,
  fees0: bigint,
  fees1: bigint,
  block: EthereumBlock
): Promise<void> {
  const pm = await PairManager.get(pmAddress);

  const netFees0 = await calcNetFees(fees0, pm!.fee);
  const netFees1 = await calcNetFees(fees1, pm!.fee);

  const zbSnapshot = await takeFeeSnapshot(
    pmAddress,
    SnapshotType.ZERO_BURN,
    block,
    netFees0,
    netFees1
  );

  // Clear out uncollected fees as zero burn collects all
  pm!.uncollectedFees0 = ZERO_BI;
  pm!.uncollectedFees1 = ZERO_BI;
  pm!.uncollectedFeesTotalInToken1 = ZERO_BD;

  // Accumulate total fees
  pm!.totalFees0 = pm!.totalFees0 + netFees0;
  pm!.totalFees1 = pm!.totalFees1 + netFees1;
  pm!.totalFeesTotalInToken1 = Number(pm!.totalFees1) + amount0InToken1(pm!.totalFees0, pm!.tick);
  
  // This snapshot is now the latest snapshot
  pm!.feeSnapshotLatestId = zbSnapshot.id;

  await pm!.save();

  await updatePairManagerReturn(pmAddress);
}