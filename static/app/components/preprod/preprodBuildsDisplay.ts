export enum PreprodBuildsDisplay {
  SIZE = 'size',
  DISTRIBUTION = 'distribution',
  SNAPSHOT = 'snapshot',
}

export function getPreprodBuildsDisplay(
  display: string | string[] | null | undefined
): PreprodBuildsDisplay {
  if (typeof display !== 'string') {
    return PreprodBuildsDisplay.SIZE;
  }

  switch (display) {
    case PreprodBuildsDisplay.DISTRIBUTION:
      return PreprodBuildsDisplay.DISTRIBUTION;
    case PreprodBuildsDisplay.SNAPSHOT:
      return PreprodBuildsDisplay.SNAPSHOT;
    case PreprodBuildsDisplay.SIZE:
    default:
      return PreprodBuildsDisplay.SIZE;
  }
}
