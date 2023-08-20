export default function clamp(
  num: number,
  min: number = 0,
  max: number = Number.MAX_SAFE_INTEGER
) {
  return num <= min ? min : num >= max ? max : num;
}
