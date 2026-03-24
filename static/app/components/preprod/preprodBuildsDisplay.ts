export enum PreprodBuildsDisplay {
  SIZE = 'size',
  DISTRIBUTION = 'distribution',
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
    case PreprodBuildsDisplay.SIZE:
    default:
      return PreprodBuildsDisplay.SIZE;
  }
}
