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

// Skips data preload if the user is on an invitation acceptance page as they might not have access to the data yet, leading to a 403 error.
// This frontend check is needed along with the backend check (see: https://github.com/getsentry/sentry/blob/cac47187ae98f105b39edf80a0fd3105c95e1cb5/src/sentry/web/client_config.py#L402-L414).
// It's necessary because when using `yarn dev-ui`, the app is Single Page Application (SPA), and routing happens client-side without a full page reload.
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
