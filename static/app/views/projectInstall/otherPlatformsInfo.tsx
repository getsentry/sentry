import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';

import {CodeBlock} from 'sentry/components/core/code';
import {ExternalLink, Link} from 'sentry/components/core/link';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project, ProjectKey} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function OtherPlatformsInfo({
  projectSlug,
  platform,
}: {
  platform: string;
  projectSlug: Project['slug'];
}) {
  const organization = useOrganization();

  const {
    data = [],
    isError,
    isPending,
    refetch,
  } = useApiQuery<ProjectKey[]>([`/projects/${organization.slug}/${projectSlug}/keys/`], {
    staleTime: Infinity,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const dsn = data[0]?.dsn?.public;

  return (
    <Wrapper>
      {t(
        "We cannot provide instructions for '%s' projects. However, please find below the DSN key for this project, which is required to instrument Sentry.",
        platform
      )}
      {dsn ? (
        <CodeBlock dark language="properties">
          {t('dsn: %s', data[0]!.dsn.public)}
        </CodeBlock>
      ) : (
        <Alert type="warning">
          {tct(
            'No DSN found for this project. You an create a new one by visiting your [link:project settings].',
            {
              link: (
                <Link
                  to={`/organizations/${organization.slug}/settings/projects/${projectSlug}/keys/`}
                />
              ),
            }
          )}
        </Alert>
      )}
      <Suggestion>
        {t(
          'Since it can be a lot of work creating a Sentry SDK from scratch, we suggest you review the following SDKs which are applicable for a wide variety of applications:'
        )}
        <List symbol="bullet">
          <ListItem>
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/">
              Browser JavaScript
            </ExternalLink>
          </ListItem>
          <ListItem>
            <ExternalLink href="https://docs.sentry.io/platforms/python/">
              Python
            </ExternalLink>
          </ListItem>
          <ListItem>
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/">
              Node.js
            </ExternalLink>
          </ListItem>
          <ListItem>
            <ExternalLink href="https://docs.sentry.io/platforms/dotnet/">
              .NET
            </ExternalLink>
          </ListItem>
          <ListItem>
            <ExternalLink href="https://docs.sentry.io/platforms/java/">
              Java
            </ExternalLink>
          </ListItem>
        </List>
      </Suggestion>
      <div>
        {tct(
          "Also there's a rich ecosystem of [link:community suported SDKs] (including NestJS, Nuxt2, Perl, CFML and Clojure).",
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/#community-supported" />
            ),
          }
        )}
      </div>
      <div>
        {tct(
          'Your favorite language or framework still cannot be found? Then we encourage you to consider [link:writing your own SDK].',
          {
            link: <ExternalLink href="https://develop.sentry.dev/sdk" />,
          }
        )}
      </div>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
const Suggestion = styled(Wrapper)`
  gap: ${space(1)};
`;
