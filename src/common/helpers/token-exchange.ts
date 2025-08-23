// Token exchange helper for SubQuery

export function amount0InToken1(amount0: bigint, tick: number): number {
  const rate = Math.pow(1.0001, tick);
  return Number(amount0) * rate;
}

export function totalAmountInToken1(
  amount0: bigint,
  amount1: bigint,
  tick: number
): number {
  return Number(amount1) + amount0InToken1(amount0, tick);
}