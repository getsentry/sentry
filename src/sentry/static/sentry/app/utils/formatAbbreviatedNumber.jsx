import floatFormat from './floatFormat';

const numberFormats = [[1000000000, 'b'], [1000000, 'm'], [1000, 'k']];

export default function formatNumber(number) {
  let b, x, y, o, p;

  number = parseInt(number, 10);

  // eslint-disable-next-line no-cond-assign
  for (let i = 0; (b = numberFormats[i]); i++) {
    x = b[0];
    y = b[1];
    o = Math.floor(number / x);
    p = number % x;
    if (o > 0) {
      if (o / 10 > 1 || !p) {
        return '' + o + y;
      }
      return '' + floatFormat(number / x, 1) + y;
    }
  }
  return '' + number.toLocaleString();
}
