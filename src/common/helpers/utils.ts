import { ONE_BD } from "../config/constants";

export function bigDecimalPower(base: number, exponent: number): number {
  if (exponent === 0) {
    return ONE_BD; // Any number to the power of 0 is 1
  }

  let result = ONE_BD;
  let currentBase = base;
  let currentExponent = Math.floor(exponent);

  while (currentExponent > 0) {
    if (currentExponent % 2 !== 0) {
      result = result * currentBase; // Multiply result by current base if exponent is odd
    }
    currentBase = currentBase * currentBase; // Square the base
    currentExponent = Math.floor(currentExponent / 2); // Halve the exponent
  }

  return result;
}