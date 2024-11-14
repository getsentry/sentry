export default function clamp(
  num: number,
  min: number = Number.MIN_SAFE_INTEGER,
  max: number = Number.MAX_SAFE_INTEGER
) {
  return num <= min ? min : num >= max ? max : num;
}
