import type {Config} from 'sentry/types/system';

function getPathParams(path: string):
  | {
      memberId: string | undefined;
      orgId: string | undefined;
      token: string | undefined;
    }
  | undefined {
  // /accept/:orgId/:memberId/:token/
  const regexWithOrgId = /^\/accept\/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)\/$/;

  let match = path.match(regexWithOrgId);
  if (match) {
    return {
      orgId: match[1],
      memberId: match[2],
      token: match[3],
    };
  }

  // /accept/:memberId/:token/
  const regexWithoutOrgId = /^\/accept\/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)\/$/;

  match = path.match(regexWithoutOrgId);
  if (match) {
    return {
      orgId: undefined,
      memberId: match[1],
      token: match[2],
    };
  }

  return undefined;
}

export function shouldPreloadData(config: Config): boolean {
  const path = window.location.pathname;

  const params = getPathParams(path);

  if (!params) {
    return config.shouldPreloadData;
  }

  const {orgId, memberId, token} = params;

  const invitePath = orgId
    ? `/accept/${orgId}/${memberId}/${token}/`
    : `/accept/${memberId}/${token}/`;

  return path !== invitePath && config.shouldPreloadData;
}
