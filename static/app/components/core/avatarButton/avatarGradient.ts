import color from 'color';

// Keeps the avatar's hue and saturation but never gets brighter than
// `ceiling`, so text designed against `ceiling` keeps its contrast.
export function getAvatarGradient(
  avatarColor: string,
  ceiling: string
): [string, string] {
  const maxLuminosity = color(ceiling).luminosity();
  let end = color(avatarColor);
  while (end.luminosity() > maxLuminosity && end.lightness() > 0) {
    end = end.lightness(Math.max(end.lightness() - 1, 0));
  }
  const start = end.lightness(Math.max(end.lightness() - 10, 0));
  return [start.hex(), end.hex()];
}
