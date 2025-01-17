import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import Placeholder from 'sentry/components/placeholder';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import marked from 'sentry/utils/marked';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';

interface Citation {
  title: string;
  url: string;
}

interface Resource {
  citations: [Citation];
  text: string;
}

interface ResourcesData {
  groupId: string;
  resources: [Resource];
  text: string;
}

export const makeGroupSummaryQueryKey = (
  organizationSlug: string,
  groupId: string
): ApiQueryKey => [
  `/organizations/${organizationSlug}/issues/${groupId}/resources/`,
  {
    method: 'POST',
  },
];

export function useGroupAiResources(
  group: Group,
  event: Event | null | undefined,
  project: Project
) {
  const organization = useOrganization();
  const aiConfig = useAiConfig(group, event, project);
  const enabled = aiConfig.hasSummary;
  const queryKey = makeGroupSummaryQueryKey(organization.slug, group.id);

  const {data, isLoading, isFetching, isError} = useApiQuery<ResourcesData>(queryKey, {
    staleTime: Infinity,
    enabled,
  });

  return {
    data,
    isPending: aiConfig.isAutofixSetupLoading || isLoading || isFetching,
    isError,
  };
}

type Props = {
  event: Event;
  group: Group;
  project: Project;
};

export function DynamicResources({group, event, project}: Props) {
  const {data, isPending, isError} = useGroupAiResources(group, event, project);

  if (isPending) {
    return <Placeholder height="2.5rem" />;
  }
  if (isError) {
    return <p>Error finding resources</p>;
  }

  if (!data?.resources?.length) {
    return <p>No relevant resources found.</p>;
  }

  // Collect unique citations by URL
  const uniqueCitations = data.resources
    .flatMap(resource => resource.citations)
    .reduce<Citation[]>((acc, citation) => {
      if (!acc.some(c => c.url === citation.url)) {
        acc.push(citation);
      }
      return acc;
    }, []);

  return (
    <Container>
      <ResourceText
        dangerouslySetInnerHTML={{
          __html: marked(data.text),
        }}
      />
      <CitationList>
        {uniqueCitations.map((citation, index) => (
          <LinkButton href={citation.url} external priority="link" key={index}>
            {citation.title}
          </LinkButton>
        ))}
      </CitationList>
    </Container>
  );
}

const Container = styled('div')`
  padding: 0 ${space(1.5)};
  background: ${p => p.theme.background};
`;

const ResourceText = styled('div')`
  text-align: justify;
  margin-bottom: 1rem;

  code {
    background: ${p => p.theme.backgroundSecondary};
    border-radius: ${p => p.theme.borderRadius};
  }

  pre code {
    display: block;
    overflow-x: auto;
    white-space: pre;
  }
`;

const CitationList = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-decoration: underline;
  text-decoration-color: ${p => p.theme.linkUnderline};
  gap: ${space(1)};
  margin-top: ${space(1)};
`;
