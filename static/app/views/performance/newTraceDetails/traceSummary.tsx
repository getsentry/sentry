import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {useFeedbackSDKIntegration} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconInfo} from 'sentry/icons/iconInfo';
import {IconLightning} from 'sentry/icons/iconLightning';
import {IconStats} from 'sentry/icons/iconStats';
import {IconTelescope} from 'sentry/icons/iconTelescope';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MarkedText} from 'sentry/utils/marked/markedText';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

interface SpanInsight {
  explanation: string;
  spanId: string;
  spanOp: string;
}

interface TraceSummaryData {
  anomalousSpans: SpanInsight[];
  keyObservations: string;
  performanceCharacteristics: string;
  suggestedInvestigations: SpanInsight[];
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
  const traceContent = useTraceSummary(traceSlug);
  const {feedback} = useFeedbackSDKIntegration();
  const organization = useOrganization();
  const location = useLocation();

  if (traceContent.isPending) {
    return <LoadingIndicator />;
  }

  if (traceContent.isError) {
    return (
      <ErrorContainer>
        <div>{t('Error loading Trace Summary')}</div>
        <FeedbackButton
          size="xs"
          feedbackOptions={{
            messagePlaceholder: t('How can we make the trace summary better for you?'),
            tags: {
              ['feedback.source']: 'trace-summary',
              ['feedback.owner']: 'ml-ai',
            },
          }}
        />
      </ErrorContainer>
    );
  }

  const investigations = traceContent.data?.suggestedInvestigations ?? [];

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

      {investigations.length > 0 ? (
        <StyledList>
          {investigations.map((span, idx) => (
            <StyledListItem key={span.spanId || idx}>
              <StyledLink
                to={getTraceDetailsUrl({
                  organization,
                  traceSlug,
                  location,
                  spanId: span.spanId,
                  dateSelection: {},
                })}
              >
                {span.spanOp}
              </StyledLink>
              - {span.explanation}
            </StyledListItem>
          ))}
        </StyledList>
      ) : (
        <SectionContent text="" />
      )}

      {feedback && (
        <FeedbackButtonContainer>
          <FeedbackButton
            size="xs"
            feedbackOptions={{
              messagePlaceholder: t('How can we make the trace summary better for you?'),
              tags: {
                ['feedback.source']: 'trace-summary',
                ['feedback.owner']: 'ml-ai',
              },
            }}
          />
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
  color: ${p => p.theme.colors.gray400};
  display: flex;
  align-items: center;
`;

const SectionTitle = styled('h6')`
  color: ${p => p.theme.colors.gray500};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  text-transform: uppercase;
  margin: 0;
`;

const SectionContent = styled(MarkedText)`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.4;
  margin-bottom: ${space(3)};

  code {
    font-family: ${p => p.theme.text.familyMono};
    padding: ${space(0.25)} ${space(0.5)};
    background: ${p => p.theme.backgroundSecondary};
    border-radius: ${p => p.theme.radius.md};
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

const StyledList = styled('ul')`
  margin: 0;
  padding-left: 20px;
`;

const StyledListItem = styled('li')`
  margin-bottom: 8px;
`;

const StyledLink = styled(Link)`
  text-decoration: none;
  color: ${p => p.theme.tokens.content.primary};
  font-weight: 600;
  margin-right: 6px;
`;
