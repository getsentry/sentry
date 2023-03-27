import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import {feedbackClient} from 'sentry/components/featureFeedback/feedbackModal';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody, PanelFooter, PanelHeader} from 'sentry/components/panels';
import {IconHappy, IconMeh, IconSad} from 'sentry/icons';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import marked from 'sentry/utils/marked';
import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {useOpenAISuggestionLocalStorage} from 'sentry/views/issueDetails/openAIFixSuggestion/useOpenAISuggestionLocalStorage';
import {experimentalFeatureTooltipDesc} from 'sentry/views/issueDetails/openAIFixSuggestion/utils';

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
  eventID: string;
  projectSlug: string;
};

export function OpenAIFixSuggestionPanel({eventID, projectSlug}: Props) {
  const user = ConfigStore.get('user');
  const organization = useOrganization();
  const router = useRouter();
  const showSuggestedFix = !!router.location.query.showSuggestedFix;
  const hasSignedDPA = false;
  const [agreedForwardDataToOpenAI] = useOpenAISuggestionLocalStorage();
  const [expandedSuggestedFix, setExpandedSuggestedFix] = useState(showSuggestedFix);

  useEffect(() => {
    setExpandedSuggestedFix(!!router.location.query.showSuggestedFix);
  }, [router.location.query.showSuggestedFix]);

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

      setExpandedSuggestedFix(false);
    },
    [user]
  );

  const {
    data,
    isLoading: dataIsLoading,
    isError: dataIsError,
    refetch: dataRefetch,
  } = useQuery<{suggestion: string}>(
    [`/projects/${organization.slug}/${projectSlug}/events/${eventID}/ai-fix-suggest/`],
    {
      staleTime: Infinity,
      enabled: (hasSignedDPA || agreedForwardDataToOpenAI) && showSuggestedFix,
    }
  );

  if (!organization.features.includes('open-ai-suggestion')) {
    return null;
  }

  if (!showSuggestedFix) {
    return null;
  }

  return (
    <FixSuggestionPanel>
      <FixSuggestionPanelHeader isExpanded={expandedSuggestedFix}>
        <HeaderDescription>
          {t('Suggested Fix')}
          <FeatureBadgeNotUppercase
            type="experimental"
            title={experimentalFeatureTooltipDesc}
          />
        </HeaderDescription>
        <Button
          size="xs"
          title={t('Toggle Suggested Fix Panel')}
          aria-label={t('Toggle Suggested Fix Panel')}
          icon={<IconChevron direction={expandedSuggestedFix ? 'up' : 'down'} />}
          onClick={() => setExpandedSuggestedFix(!expandedSuggestedFix)}
        />
      </FixSuggestionPanelHeader>
      {expandedSuggestedFix && (
        <Fragment>
          <PanelBody withPadding>
            {dataIsLoading ? (
              <LoadingIndicator />
            ) : dataIsError ? (
              <LoadingErrorWithoutMarginBottom onRetry={dataRefetch} />
            ) : (
              <div
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
          )}
        </Fragment>
      )}
    </FixSuggestionPanel>
  );
}

const FixSuggestionPanel = styled(Panel)`
  margin-top: ${space(1.5)};
  margin-bottom: 0;
  overflow: hidden;
`;

const FixSuggestionPanelHeader = styled(PanelHeader)<{isExpanded: boolean}>`
  border-bottom: ${p => (p.isExpanded ? 'inherit' : 'none')};
`;

const HeaderDescription = styled('div')`
  display: flex;
  align-items: center;
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

const FeatureBadgeNotUppercase = styled(FeatureBadge)`
  text-transform: capitalize;
`;
