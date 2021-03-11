function routeTitleGen(
  routeName: string,
  orgSlug: string,
  withSentry: boolean = true,
  projectSlug?: string
): string {
  const tmplBase = `${routeName} - ${orgSlug}`;
  const tmpl = projectSlug ? `${tmplBase} - ${projectSlug}` : tmplBase;

  return withSentry ? `${tmpl} - Sentry` : tmpl;
}

export default routeTitleGen;
