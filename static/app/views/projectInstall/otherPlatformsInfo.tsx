import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project, ProjectKey} from 'sentry/types';
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
    isLoading,
    refetch,
  } = useApiQuery<ProjectKey[]>([`/projects/${organization.slug}/${projectSlug}/keys/`], {
    staleTime: Infinity,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <Wrapper>
      {t(
        "We cannot provide instructions for '%s' projects. However, please find below the DSN key for this project, which is required to instrument Sentry.",
        platform
      )}
      <CodeSnippet dark language="bash">
        {t('dsn: %s', data[0].dsn.public)}
      </CodeSnippet>
      <Suggestion>
        {t(
          'Since it can be a lot work creating a Sentry SDK from scratch, we suggest you review the following SDKs which are applicable for a wide variety of applications:'
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
            <ExternalLink href="https://docs.sentry.io/platforms/node/">
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
              JAVA
            </ExternalLink>
          </ListItem>
        </List>
      </Suggestion>
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
