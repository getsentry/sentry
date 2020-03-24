import floatFormat from './floatFormat';

const numberFormats = [
  [1000000000, 'b'],
  [1000000, 'm'],
  [1000, 'k'],
] as const;

export default function formatNumber(number: number | string) {
  number = Number(number);

  let lookup: typeof numberFormats[number];

  // eslint-disable-next-line no-cond-assign
  for (let i = 0; (lookup = numberFormats[i]); i++) {
    const [suffixNum, suffix] = lookup;
    const shortValue = Math.floor(number / suffixNum);
    const fitsBound = number % suffixNum;

    if (shortValue <= 0) {
      continue;
    }

    return shortValue / 10 > 1 || !fitsBound
      ? `${shortValue}${suffix}`
      : `${floatFormat(number / suffixNum, 1)}${suffix}`;
  }

  return number.toLocaleString();
}
