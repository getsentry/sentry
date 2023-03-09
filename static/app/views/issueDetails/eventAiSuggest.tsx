import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import shuffle from 'lodash/shuffle';

import FeatureBadge from 'sentry/components/featureBadge';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import marked from 'sentry/utils/marked';
import useApi from 'sentry/utils/useApi';

type Props = {
  event: Event;
  organization: Organization;
  project: Project;
};

const LOADING_MESSAGES = [
  'Heating up them GPUs',
  'Engineering a prompt',
  'Demonstrating value',
  'Moving the needle',
  'Preventing prompt injection attacks',
  'Remove traces of depression from answers',
  'Reticulating splines or whatever',
  'Loading marketing material',
  'Wiping node_modules',
  'Installing dependencies',
  'Searching StackOverflow',
  'Googling for solutions',
  'Runing spell checker',
  'Searching for the perfect emoji',
  'Adding trace amounts of human touch',
  "Don't be like Sydney, don't be like Sydney",
  'Initiating quantum leap',
  'Charging flux capacitors',
  'Summoning a demon',
];

function AiLoadingMessage() {
  const [messages] = useState(() => shuffle(LOADING_MESSAGES));
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      if (messageIndex < messages.length - 1) {
        setMessageIndex(messageIndex + 1);
      }
    }, Math.random() * 700 + 800);
    return () => clearInterval(id);
  });

  return (
    <div>
      <strong>{messages[messageIndex]}…</strong>
    </div>
  );
}

export function EventAiSuggest({event, organization, project}: Props) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

  useEffect(() => {
    let cancel = false;
    const endpoint = `/projects/${organization.slug}/${project.slug}/events/${event.id}/ai-suggest/`;

    setLoading(true);
    api
      .requestPromise(endpoint, {
        method: 'GET',
      })
      .then(result => {
        if (!cancel) {
          setSuggestion(result.suggestion);
        }
      })
      .catch(() => {
        if (!cancel) {
          setError(true);
        }
      })
      .finally(() => {
        setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [organization.slug, project.slug, event.id, api]);

  if (loading) {
    return (
      <Wrapper>
        <LoadingIndicator>
          <AiLoadingMessage />
        </LoadingIndicator>
      </Wrapper>
    );
  }
  if (error) {
    return (
      <Wrapper>
        <LoadingError />
      </Wrapper>
    );
  }
  if (suggestion) {
    return (
      <Wrapper>
        <h2>
          {t('Potentially Helpful AI Assistent')}
          <FeatureBadge type="experimental" />
        </h2>
        <div
          dangerouslySetInnerHTML={{
            __html: marked(suggestion, {
              gfm: true,
              breaks: true,
            }),
          }}
        />
      </Wrapper>
    );
  }
  return <Fragment />;
}

// compensate the margins from DataSection
const Wrapper = styled('div')`
  background-color: ${p => p.theme.surface200};
  box-shadow: 0 0 10px ${p => p.theme.gray200} inset;
  border-top: 1px solid ${p => p.theme.gray200};
  border-bottom: 1px solid ${p => p.theme.gray200};
  margin: ${space(1)} -${space(2)};
  padding: ${space(1)} ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin: ${space(2)} -${space(4)};
    padding: ${space(4)} ${space(4)} ${space(2)} ${space(4)};
  }
`;
