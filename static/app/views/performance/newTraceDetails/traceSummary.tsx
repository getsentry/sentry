import styled from '@emotion/styled';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconMegaphone} from 'sentry/icons';
import {IconInfo} from 'sentry/icons/iconInfo';
import {IconLightning} from 'sentry/icons/iconLightning';
import {IconStats} from 'sentry/icons/iconStats';
import {IconTelescope} from 'sentry/icons/iconTelescope';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MarkedText} from 'sentry/utils/marked/markedText';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TraceContextSectionKeys} from 'sentry/views/performance/newTraceDetails/traceHeader/scrollToSectionLinks';

interface TraceSummaryData {
  keyObservations: string;
  performanceCharacteristics: string;
  suggestedInvestigations: string;
  summary: string;
  traceId: string;
}

const makeTraceSummaryQueryKey = (
  organizationSlug: string,
  traceSlug: string
): ApiQueryKey => [
  `/organizations/${organizationSlug}/trace-summary/`,
  {method: 'POST', data: {traceSlug}},
];

function useTraceSummary(traceSlug: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const queryKey = makeTraceSummaryQueryKey(organization.slug, traceSlug);

  const {data, isLoading, isFetching, isError, refetch} = useApiQuery<TraceSummaryData>(
    queryKey,
    {
      staleTime: Infinity,
      enabled: true,
    }
  );

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: [`/organizations/${organization.slug}/trace-summary/`],
      exact: false,
    });
    refetch();
  };

  return {
    data,
    isPending: isLoading || isFetching,
    isError,
    refresh,
  };
}

export function TraceSummarySection({traceSlug}: {traceSlug: string}) {
  return (
    <InterimSection
      key="trace-summary"
      type={TraceContextSectionKeys.SUMMARY}
      title={
        <TitleWrapper>
          {t('Trace Summary')}
          <FeatureBadge type="alpha" />
        </TitleWrapper>
      }
      data-test-id="trace-summary-section"
      initialCollapse={false}
    >
      <TraceSummaryContent traceSlug={traceSlug} />
    </InterimSection>
  );
}

const TitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

function TraceSummaryContent({traceSlug}: {traceSlug: string}) {
  const traceContent = useTraceSummary(traceSlug);
  const openFeedbackForm = useFeedbackForm();

  if (traceContent.isPending) {
    return <LoadingIndicator />;
  }

  if (traceContent.isError) {
    return (
      <ErrorContainer>
        <div>{t('Error loading Trace Summary')}</div>
        {openFeedbackForm && (
          <Button
            size="xs"
            icon={<IconMegaphone size="xs" />}
            onClick={() =>
              openFeedbackForm({
                messagePlaceholder: t(
                  'How can we make the trace summary better for you?'
                ),
                tags: {
                  ['feedback.source']: 'trace-summary',
                  ['feedback.owner']: 'ml-ai',
                },
              })
            }
          >
            {t('Give Feedback')}
          </Button>
        )}
      </ErrorContainer>
    );
  }

  return (
    <SummaryContainer>
      <SectionTitleWrapper>
        <StyledIcon>
          <IconInfo size="sm" />
        </StyledIcon>
        <SectionTitle>Overview</SectionTitle>
      </SectionTitleWrapper>
      <SectionContent text={traceContent.data?.summary ?? ''} />

      <SectionTitleWrapper>
        <StyledIcon>
          <IconTelescope size="sm" />
        </StyledIcon>
        <SectionTitle>Key Observations</SectionTitle>
      </SectionTitleWrapper>
      <SectionContent text={traceContent.data?.keyObservations ?? ''} />

      <SectionTitleWrapper>
        <StyledIcon>
          <IconStats size="sm" />
        </StyledIcon>
        <SectionTitle>Performance Characteristics</SectionTitle>
      </SectionTitleWrapper>
      <SectionContent text={traceContent.data?.performanceCharacteristics ?? ''} />

      <SectionTitleWrapper>
        <StyledIcon>
          <IconLightning size="sm" />
        </StyledIcon>
        <SectionTitle>Suggested Investigations</SectionTitle>
      </SectionTitleWrapper>
      <SectionContent text={traceContent.data?.suggestedInvestigations ?? ''} />

      {openFeedbackForm && (
        <FeedbackButtonContainer>
          <Button
            size="xs"
            icon={<IconMegaphone size="xs" />}
            onClick={() =>
              openFeedbackForm({
                messagePlaceholder: t(
                  'How can we make the trace summary better for you?'
                ),
                tags: {
                  ['feedback.source']: 'trace-summary',
                  ['feedback.owner']: 'ml-ai',
                },
              })
            }
          >
            {t('Give Feedback')}
          </Button>
        </FeedbackButtonContainer>
      )}
    </SummaryContainer>
  );
}

const SummaryContainer = styled('div')`
  padding: ${space(2)};
`;

const SectionTitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  margin-bottom: ${space(1)};
`;

const StyledIcon = styled('div')`
  color: ${p => p.theme.gray300};
  display: flex;
  align-items: center;
`;

const SectionTitle = styled('h6')`
  color: ${p => p.theme.gray400};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
  text-transform: uppercase;
  margin: 0;
`;

const SectionContent = styled(MarkedText)`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1.4;
  margin-bottom: ${space(3)};

  code {
    font-family: ${p => p.theme.text.familyMono};
    padding: ${space(0.25)} ${space(0.5)};
    background: ${p => p.theme.backgroundSecondary};
    border-radius: ${p => p.theme.borderRadius};
    font-size: 0.9em;
  }

  strong {
    font-weight: 600;
  }
`;

const ErrorContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(2)};
`;

const FeedbackButtonContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-top: ${space(2)};
`;
