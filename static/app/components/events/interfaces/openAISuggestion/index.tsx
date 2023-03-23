import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import FeatureBadge from 'sentry/components/featureBadge';
import {feedbackClient} from 'sentry/components/featureFeedback/feedbackModal';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody, PanelFooter} from 'sentry/components/panels';
import {IconHappy, IconMeh, IconSad} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {Event, Project} from 'sentry/types';
import marked from 'sentry/utils/marked';
import {useQuery} from 'sentry/utils/queryClient';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';

enum OpenAISatisfactoryLevel {
  HELPED = 'helped',
  PARTIALLY_HELPED = 'partially_helped',
  DID_NOT_HELP = 'did_not_help',
}

const openAIFeedback = {
  [OpenAISatisfactoryLevel.HELPED]: t('It helped me solve the issue'),
  [OpenAISatisfactoryLevel.PARTIALLY_HELPED]: t('It partially helped me solve the issue'),
  [OpenAISatisfactoryLevel.DID_NOT_HELP]: t('It did not help me solve the issue'),
};

type Props = {
  eventID: Event['eventID'];
  projectSlug: Project['slug'];
};

export function OpenAISuggestion({eventID, projectSlug}: Props) {
  const user = ConfigStore.get('user');
  const organization = useOrganization();

  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const hasSignedDPA = false;

  const OPEN_AI_SUGGESTION_PREFERENCE_KEY = `open-ai-suggestion-preference:${user.id}`;

  const [localStorageState, setLocalStorageState] = useLocalStorageState<{
    agreedForwardDataToOpenAI: boolean;
  }>(OPEN_AI_SUGGESTION_PREFERENCE_KEY, {
    agreedForwardDataToOpenAI: false,
  });

  const {
    data,
    isLoading: dataIsLoading,
    isError: dataIsError,
    refetch: dataRefetch,
  } = useQuery<{suggestion: string}>(
    [`/projects/${organization.slug}/${projectSlug}/events/${eventID}/ai-fix-suggest/`],
    {
      staleTime: Infinity,
      enabled:
        (hasSignedDPA || localStorageState.agreedForwardDataToOpenAI) && suggestionOpen,
    }
  );

  const handleShowAISuggestion = useCallback(() => {
    setSuggestionOpen(!suggestionOpen);
  }, [suggestionOpen]);

  const handleDataForwardToOpenAIAgreement = useCallback(() => {
    setLocalStorageState({agreedForwardDataToOpenAI: true});
    setSuggestionOpen(true);
  }, [setLocalStorageState]);

  const handleOpenAISuggestionFeedback = useCallback(
    (openAISatisfactoryLevel: OpenAISatisfactoryLevel) => {
      feedbackClient.captureEvent({
        request: {
          url: window.location.href, // gives the full url (origin + pathname)
        },
        tags: {
          featureName: 'openai-suggestion',
        },
        user,
        level: 'info',
        message: `OpenAI Suggestion Feedback - ${openAIFeedback[openAISatisfactoryLevel]}`,
      });

      addSuccessMessage('Thank you for your feedback!');

      setSuggestionOpen(false);
    },
    [user]
  );

  if (!organization.features.includes('openai-suggestion')) {
    return null;
  }

  return (
    <EventDataSection
      type="suggested-fix"
      title={
        <div>
          {t('Suggested Fix')}
          <FeatureBadge
            type="experimental"
            title={t(
              'This is an AI generated solution that suggests a fix for this event. Be aware that this may not be accurate.'
            )}
          />
        </div>
      }
      actions={
        <Confirm
          bypass={hasSignedDPA || localStorageState.agreedForwardDataToOpenAI}
          priority="primary"
          message={t(
            'By using this feature, you agree that OpenAI is a subprocessor and may process the data that you’ve chosen to submit. Sentry makes no guarantees as to the accuracy of the feature’s AI-generated recommendations.'
          )}
          onConfirm={
            hasSignedDPA || localStorageState.agreedForwardDataToOpenAI
              ? handleShowAISuggestion
              : handleDataForwardToOpenAIAgreement
          }
        >
          <ToggleButton priority="link">
            {suggestionOpen ? t('Hide Suggestion') : t('Show Suggestion')}
          </ToggleButton>
        </Confirm>
      }
    >
      {suggestionOpen ? (
        dataIsLoading ? (
          <LoadingIndicator />
        ) : dataIsError ? (
          <LoadingErrorWithoutMarginBottom onRetry={dataRefetch} />
        ) : (
          <PanelWithoutMarginBottom>
            <PanelBody withPadding>
              <div
                dangerouslySetInnerHTML={{
                  __html: marked(data.suggestion, {
                    gfm: true,
                    breaks: true,
                  }),
                }}
              />
            </PanelBody>
            <PanelFooter>
              <Feedback>
                <strong>{t('Was this helpful?')}</strong>
                <div>
                  <Button
                    title={openAIFeedback[OpenAISatisfactoryLevel.DID_NOT_HELP]}
                    aria-label={openAIFeedback[OpenAISatisfactoryLevel.DID_NOT_HELP]}
                    icon={<IconSad color="red300" />}
                    size="xs"
                    borderless
                    onClick={() =>
                      handleOpenAISuggestionFeedback(OpenAISatisfactoryLevel.DID_NOT_HELP)
                    }
                  />
                  <Button
                    title={openAIFeedback[OpenAISatisfactoryLevel.PARTIALLY_HELPED]}
                    aria-label={openAIFeedback[OpenAISatisfactoryLevel.PARTIALLY_HELPED]}
                    icon={<IconMeh color="yellow300" />}
                    size="xs"
                    borderless
                    onClick={() =>
                      handleOpenAISuggestionFeedback(
                        OpenAISatisfactoryLevel.PARTIALLY_HELPED
                      )
                    }
                  />
                  <Button
                    title={openAIFeedback[OpenAISatisfactoryLevel.HELPED]}
                    aria-label={openAIFeedback[OpenAISatisfactoryLevel.HELPED]}
                    icon={<IconHappy color="green300" />}
                    size="xs"
                    borderless
                    onClick={() =>
                      handleOpenAISuggestionFeedback(OpenAISatisfactoryLevel.HELPED)
                    }
                  />
                </div>
              </Feedback>
            </PanelFooter>
          </PanelWithoutMarginBottom>
        )
      ) : null}
    </EventDataSection>
  );
}

const ToggleButton = styled(Button)`
  font-weight: 700;
  color: ${p => p.theme.subText};
  &:hover,
  &:focus {
    color: ${p => p.theme.textColor};
  }
`;

const PanelWithoutMarginBottom = styled(Panel)`
  margin-bottom: 0;
`;

const Feedback = styled('div')`
  padding: ${space(1)} ${space(2)};
  display: grid;
  grid-template-columns: 1fr max-content max-content max-content;
  align-items: center;
  text-align: right;
  gap: ${space(1)};
`;

const LoadingErrorWithoutMarginBottom = styled(LoadingError)`
  margin-bottom: 0;
`;
