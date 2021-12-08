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
      // since spec is still in dev, just gracefully return whatever we received.
      return marker;
  }
}
