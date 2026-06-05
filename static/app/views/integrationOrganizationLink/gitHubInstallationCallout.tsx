import {useEffect} from 'react';
import {queryOptions, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {ExternalLink} from '@sentry/scraps/link';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t, tct} from 'sentry/locale';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {selectJson} from 'sentry/utils/api/apiOptions';

interface GitHubIntegrationInstallation {
  account: {
    login: string;
    type: string;
  };
  sender: {
    id: number;
    login: string;
  };
}

// XXX: The GitHub installation info endpoint is the odd one out. Unlike the
// rest of the JSON endpoints the frontend consumes, it lives at
// `/extensions/github/installation/:id/` rather than under `/api/0/`. It was
// registered alongside the GitHub webhook + OAuth callback URLs in
// `src/sentry/integrations/github/urls.py` (which all `include()` under the
// `/extensions/github/` namespace) instead of being added to
// `src/sentry/api/urls.py` next to the rest of the integration endpoints.
//
// Because it's outside `/api/0/`, the standard `apiOptions` factory — which
// resolves paths against the `/api/0/` base URL — can't reach it. So we hand-
// roll a `queryOptions` factory that mirrors what `apiOptions` produces:
//
//  - an unprefixed `Client({baseUrl: ''})` so the absolute path is sent as-is,
//  - a `queryFn` that returns the `ApiResponse<T>` `{json, headers}` shape so
//    the React-Query cache stores the same value our other queries do,
//  - `select: selectJson` so consumers see the unwrapped JSON.
const NO_PREFIX_API_CLIENT = new Client({baseUrl: ''});

function gitHubInstallationOptions(installationId: string) {
  return queryOptions({
    queryKey: ['github-installation', installationId] as const,
    queryFn: async (): Promise<ApiResponse<GitHubIntegrationInstallation>> => {
      const [json, , response] = await NO_PREFIX_API_CLIENT.requestPromise(
        `/extensions/github/installation/${installationId}/`,
        {includeAllArgs: true}
      );
      return {
        json: json as GitHubIntegrationInstallation,
        headers: {
          Link: response?.getResponseHeader('Link') ?? undefined,
        },
      };
    },
    staleTime: Infinity,
    select: selectJson,
  });
}

interface Props {
  installationId: string;
}

/**
 * Renders the "X has installed the Sentry GitHub app to Y" callout shown when
 * the user lands on the org-link page from a GitHub-initiated install (i.e.
 * the user installed the Sentry app from GitHub's side rather than from the
 * Sentry integrations directory). Fetches the installation's sender + target
 * account from the backend so the user can confirm the install came from them.
 *
 * If the lookup fails we render a warning instead — the install can still
 * proceed but the sender couldn't be verified.
 */
export function GitHubInstallationCallout({installationId}: Props) {
  const {data, error, isPending} = useQuery(gitHubInstallationOptions(installationId));

  useEffect(() => {
    if (error) {
      addErrorMessage(t('Failed to retrieve GitHub installation details'));
    }
  }, [error]);

  if (isPending) {
    return null;
  }

  if (!data) {
    return (
      <Alert.Container>
        <Alert variant="warning">
          {t(
            'We could not verify the authenticity of the installation request. We recommend restarting the installation process.'
          )}
        </Alert>
      </Alert.Container>
    );
  }

  const senderUrl = `https://github.com/${data.sender.login}`;
  const targetUrl = `https://github.com/${data.account.login}`;

  return (
    <Alert.Container>
      <Alert variant="info">
        {tct(
          'GitHub user [senderLogin] has installed GitHub app to [accountType] [accountLogin]. Proceed if you want to attach this installation to your Sentry account.',
          {
            accountType: <strong>{data.account.type}</strong>,
            accountLogin: (
              <strong>
                <ExternalLink href={targetUrl}>{data.account.login}</ExternalLink>
              </strong>
            ),
            senderLogin: (
              <strong>
                <ExternalLink href={senderUrl}>{data.sender.login}</ExternalLink>
              </strong>
            ),
          }
        )}
      </Alert>
    </Alert.Container>
  );
}
