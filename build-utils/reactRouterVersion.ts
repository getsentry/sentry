export function getReactRouterVersion(
  env: NodeJS.ProcessEnv,
  development = true
): '6' | '8' {
  const version = env.SENTRY_REACT_ROUTER_VERSION;
  if (version !== undefined && version !== '6' && version !== '8') {
    throw new Error('SENTRY_REACT_ROUTER_VERSION must be 6 or 8');
  }

  // Only local development can override the production router version.
  return development ? (version ?? '8') : '6';
}
