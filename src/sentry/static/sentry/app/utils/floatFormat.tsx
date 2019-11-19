export default function floatFormat(number: number, places: number) {
  const multi = Math.pow(10, places);
  return parseInt((number * multi).toString(), 10) / multi;
}
