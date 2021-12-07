export function stackMarkerToHumanReadable(marker: JSSelfProfiling.Marker): string {
  switch (marker) {
    case 'gc':
      return 'Garbage Collection';
    case 'style':
      return 'Style';
    case 'layout':
      return 'Layout';
    case 'paint':
      return 'Paint';
    case 'script':
      return 'Script';
    case 'other':
      return 'Other';
    default:
      throw new TypeError(`Unknown marker of type ${marker}`);
  }
}
