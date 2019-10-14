function routeTitleGen(
  routeName: string,
  orgSlug: string,
  withSentry: boolean = true
): string {
  const tmpl = `${routeName} - ${orgSlug}`;
  return withSentry ? `${tmpl} - Sentry` : tmpl;
}

export default routeTitleGen;
