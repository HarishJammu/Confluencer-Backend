/**
 * Money Utility
 * 
 * Provides exact decimal handling using integer minor units (cents)
 * to avoid JavaScript floating-point arithmetic errors.
 * Supports up to 2 decimal places as specified by DECIMAL(18,2).
 */

/**
 * Converts a decimal string or number to integer minor units (cents).
 * E.g., "125.50" -> 12550n, 10 -> 1000n, "0.05" -> 5n
 * 
 * @param {string|number} value 
 * @returns {bigint}
 */
function toMinorUnits(value) {
  if (value === null || value === undefined) {
    throw new Error('Value cannot be null or undefined for money conversion');
  }

  const str = String(value).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(str)) {
    throw new Error(`Invalid money format: "${value}". Expected at most 2 decimal places.`);
  }

  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1) : str;

  const [whole, fraction = ''] = cleanStr.split('.');
  const paddedFraction = fraction.padEnd(2, '0').slice(0, 2);
  const totalUnits = BigInt(whole + paddedFraction);

  return isNegative ? -totalUnits : totalUnits;
}

/**
 * Converts integer minor units (cents) to a 2-decimal string format.
 * E.g., 12550n -> "125.50", 5n -> "0.05", 0n -> "0.00"
 * 
 * @param {bigint|number} minorUnits 
 * @returns {string}
 */
function toDecimalString(minorUnits) {
  const units = BigInt(minorUnits);
  const isNegative = units < 0n;
  const absUnits = isNegative ? -units : units;

  const str = absUnits.toString().padStart(3, '0');
  const whole = str.slice(0, -2);
  const frac = str.slice(-2);

  return `${isNegative ? '-' : ''}${whole}.${frac}`;
}

/**
 * Adds two monetary values exactly.
 * 
 * @param {string|number} a 
 * @param {string|number} b 
 * @returns {string} Result formatted as "0.00"
 */
function addMoney(a, b) {
  const resultUnits = toMinorUnits(a) + toMinorUnits(b);
  return toDecimalString(resultUnits);
}

/**
 * Subtracts b from a exactly.
 * 
 * @param {string|number} a 
 * @param {string|number} b 
 * @returns {string} Result formatted as "0.00"
 */
function subtractMoney(a, b) {
  const resultUnits = toMinorUnits(a) - toMinorUnits(b);
  return toDecimalString(resultUnits);
}

/**
 * Compares two monetary values.
 * Returns true if a >= b.
 * 
 * @param {string|number} a 
 * @param {string|number} b 
 * @returns {boolean}
 */
function isGreaterOrEqual(a, b) {
  return toMinorUnits(a) >= toMinorUnits(b);
}

/**
 * Compares two monetary values.
 * Returns true if a > b.
 * 
 * @param {string|number} a 
 * @param {string|number} b 
 * @returns {boolean}
 */
function isGreaterThan(a, b) {
  return toMinorUnits(a) > toMinorUnits(b);
}

module.exports = {
  toMinorUnits,
  toDecimalString,
  addMoney,
  subtractMoney,
  isGreaterOrEqual,
  isGreaterThan
};
