import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project, ProjectKey} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function OtherPlatformsInfo({projectSlug}: {projectSlug: Project['slug']}) {
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
        "We cannot provide instructions for 'other' projects. However, please find below the DSN key for this project, which is required to instrument Sentry."
      )}
      <CodeSnippet dark language="bash">
        {data[0].dsn.public}
      </CodeSnippet>
      {t(
        'If you use a lesser-known platform, we suggest creating a new project using following SDKs:'
      )}
      <List symbol="bullet">
        <ListItem>Browser JavaScript</ListItem>
        <ListItem>Python</ListItem>
        <ListItem>Node</ListItem>
        <ListItem>.NET</ListItem>
        <ListItem>JAVA</ListItem>
      </List>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
