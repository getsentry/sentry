import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import marked from 'sentry/utils/marked';
import {useQuery} from 'sentry/utils/queryClient';

type Props = {
  event: Event;
  organization: Organization;
  project: Project;
};

interface SuggestionResponse {
  suggestion: string;
}

function EventAiSuggestion({event, organization, project}: Props) {
  const {data, isLoading, error} = useQuery<SuggestionResponse>(
    [`/projects/${organization.slug}/${project.slug}/events/${event.id}/ai-suggest/`],
    {
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  if (isLoading) {
    return <LoadingIndicator />;
  }
  if (error) {
    return <LoadingError />;
  }
  if (data.suggestion) {
    return (
      <AIAnswer>
        <div dangerouslySetInnerHTML={{__html: marked(data.suggestion)}} />
      </AIAnswer>
    );
  }
  return <Fragment />;
}

export function EventAiSuggest({event, organization, project}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <EventDataSection title="Resources and Maybe-Fixes" type="description">
        <p>
          Here are a few potential fixes pulled from various sources.
          {visible ? (
            <EventAiSuggestion
              event={event}
              organization={organization}
              project={project}
            />
          ) : (
            <div>
              <GenerateSuggestion
                size="sm"
                onClick={() => {
                  setVisible(true);
                }}
              >
                View Maybe-Fixes
              </GenerateSuggestion>
            </div>
          )}
        </p>
      </EventDataSection>
    </div>
  );
}

const AIAnswer = styled('pre')`
  padding: ${space(4)} ${space(4)} ${space(2)};
  margin-top: ${space(3)};
  word-break: normal;
`;

const GenerateSuggestion = styled(Button)`
  margin-top: ${space(4)};
`;
