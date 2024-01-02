import {useCallback} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconFile, IconFlag, IconHappy, IconMeh, IconSad} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {Event, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import marked from 'sentry/utils/marked';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {ExperimentalFeatureBadge} from './experimentalFeatureBadge';
import {SuggestionLoaderMessage} from './suggestionLoaderMessage';
import {useOpenAISuggestionLocalStorage} from './useOpenAISuggestionLocalStorage';

type Props = {
  event: Event;
  onHideSuggestion: () => void;
  projectSlug: Project['slug'];
};

function ErrorDescription({
  restriction,
  organizationSlug,
  onRefetch,
  onSetIndividualConsent,
  onHideSuggestion,
}: {
  onHideSuggestion: () => void;
  onRefetch: () => void;
  onSetIndividualConsent: (consent: boolean) => void;
  organizationSlug: string;
  restriction?: 'subprocessor' | 'individual_consent';
}) {
  if (restriction === 'subprocessor') {
    return (
      <EmptyMessage
        icon={<IconFile size="xl" />}
        title={t('OpenAI Subprocessor Acknowledgment')}
        description={t(
          'In order to use this feature, your organization needs to accept the OpenAI Subprocessor Acknowledgment.'
        )}
        action={
          <ButtonBar gap={2}>
            <Button onClick={onHideSuggestion}>{t('Dismiss')}</Button>
            <Button priority="primary" to={`/settings/${organizationSlug}/legal/`}>
              {t('Accept in Settings')}
            </Button>
          </ButtonBar>
        }
      />
    );
  }

  if (restriction === 'individual_consent') {
    const {isStaff} = ConfigStore.get('user');

    const title = isStaff ? t('Confirm there is no PII') : t('We need your consent');
    const description = isStaff
      ? t(
          'Before using this feature, please confirm that there is no personally identifiable information in this event.'
        )
      : t(
          'By using this feature, you agree that OpenAI is a subprocessor and may process the data that you’ve chosen to submit. Sentry makes no guarantees as to the accuracy of the feature’s AI-generated recommendations.'
        );

    const activeSuperUser = isActiveSuperuser();
    return (
      <EmptyMessage
        icon={<IconFlag size="xl" />}
        title={title}
        description={description}
        action={
          <ButtonBar gap={2}>
            <Button onClick={onHideSuggestion}>{t('Dismiss')}</Button>
            <Button
              priority="primary"
              onClick={() => {
                onSetIndividualConsent(true);
                onRefetch();
              }}
              disabled={activeSuperUser}
              title={
                activeSuperUser ? t("Superusers can't consent to policies") : undefined
              }
            >
              {t('Confirm')}
            </Button>
          </ButtonBar>
        }
      />
    );
  }

  return <SuggestionLoadingError onRetry={onRefetch} />;
}

export function Suggestion({onHideSuggestion, projectSlug, event}: Props) {
  const organization = useOrganization();
  const [suggestedSolutionLocalConfig, setSuggestedSolutionLocalConfig] =
    useOpenAISuggestionLocalStorage();

  const {
    data,
    isLoading: dataIsLoading,
    isError: dataIsError,
    refetch: dataRefetch,
    error,
  } = useApiQuery<{suggestion: string}>(
    [
      `/projects/${organization.slug}/${projectSlug}/events/${event.eventID}/ai-fix-suggest/`,
      {
        query: {
          consent: suggestedSolutionLocalConfig.individualConsent ? 'yes' : undefined,
        },
      },
    ],
    {
      staleTime: Infinity,
      retry: false,
    }
  );

  const handleFeedbackClick = useCallback(() => {
    addSuccessMessage('Thank you for your feedback!');
  }, []);

  return (
    <Panel>
      <Header>
        <Title>
          {t('AI Solution')}
          <ExperimentalFeatureBadge />
        </Title>
        <Button size="xs" onClick={onHideSuggestion}>
          {t('Hide Suggestion')}
        </Button>
      </Header>
      <PanelBody>
        {dataIsLoading ? (
          <LoaderWrapper>
            <div className="ai-suggestion-wheel-of-fortune" />
            <SuggestionLoaderMessage />
          </LoaderWrapper>
        ) : dataIsError ? (
          <ErrorDescription
            onRefetch={dataRefetch}
            organizationSlug={organization.slug}
            onSetIndividualConsent={() =>
              setSuggestedSolutionLocalConfig({individualConsent: true})
            }
            restriction={error?.responseJSON?.restriction as any}
            onHideSuggestion={onHideSuggestion}
          />
        ) : (
          <Content
            dangerouslySetInnerHTML={{
              __html: marked(data.suggestion, {
                gfm: true,
                breaks: true,
              }),
            }}
          />
        )}
      </PanelBody>
      {!dataIsLoading && !dataIsError && (
        <PanelFooter>
          <Feedback>
            <strong>{t('Was this helpful?')}</strong>
            <ButtonBar gap={1}>
              <Button
                icon={<IconSad color="red300" />}
                size="xs"
                onClick={() => {
                  trackAnalytics(
                    'ai_suggested_solution.feedback_helpful_nope_button_clicked',
                    {
                      organization,
                      project_id: event.projectID,
                      group_id: event.groupID,
                      ...getAnalyticsDataForEvent(event),
                    }
                  );

                  handleFeedbackClick();
                }}
              >
                {t('Nope')}
              </Button>
              <Button
                icon={<IconMeh color="yellow300" />}
                size="xs"
                onClick={() => {
                  trackAnalytics(
                    'ai_suggested_solution.feedback_helpful_kinda_button_clicked',
                    {
                      organization,
                      project_id: event.projectID,
                      group_id: event.groupID,
                      ...getAnalyticsDataForEvent(event),
                    }
                  );

                  handleFeedbackClick();
                }}
              >
                {t('Kinda')}
              </Button>
              <Button
                icon={<IconHappy color="green300" />}
                size="xs"
                onClick={() => {
                  trackAnalytics(
                    'ai_suggested_solution.feedback_helpful_yes_button_clicked',
                    {
                      organization,
                      project_id: event.projectID,
                      group_id: event.groupID,
                      ...getAnalyticsDataForEvent(event),
                    }
                  );

                  handleFeedbackClick();
                }}
              >
                {t('Yes, Surprisingly\u2026')}
              </Button>
            </ButtonBar>
          </Feedback>
        </PanelFooter>
      )}
    </Panel>
  );
}

const Header = styled(PanelHeader)`
  background: transparent;
  padding: ${space(1)} ${space(2)};
  align-items: center;
  color: ${p => p.theme.gray300};
`;

const Feedback = styled('div')`
  padding: ${space(1)} ${space(2)};
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  text-align: left;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr max-content;
    text-align: right;
    gap: ${space(2)};
  }
`;

const SuggestionLoadingError = styled(LoadingError)`
  margin-bottom: 0;
  border: none;
  /* This is just to be consitent with other */
  /* padding-top and padding-bottom we are using in the empty state component */
  padding-top: ${space(4)};
  padding-bottom: ${space(4)};
`;

const LoaderWrapper = styled('div')`
  padding: ${space(4)} 0;
  text-align: center;
  gap: ${space(2)};
  display: flex;
  flex-direction: column;
`;

const Content = styled('div')`
  padding: ${space(2)};
  /* hack until we update backend to send us other heading */
  h4 {
    font-size: ${p => p.theme.fontSizeExtraLarge};
    margin-bottom: ${space(1)};
  }
`;

const Title = styled('div')`
  /* to be consistent with the feature badge size */
  height: ${space(2)};
  line-height: ${space(2)};
  display: flex;
  align-items: center;
`;
