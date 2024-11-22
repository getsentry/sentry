import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {IconFatal, IconFocus, IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import marked from 'sentry/utils/marked';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/useAiConfig';

interface GroupSummaryData {
  groupId: string;
  headline: string;
  possibleCause?: string | null;
  trace?: string | null;
  whatsWrong?: string | null;
}

export const makeGroupSummaryQueryKey = (
  organizationSlug: string,
  groupId: string
): ApiQueryKey => [
  `/organizations/${organizationSlug}/issues/${groupId}/summarize/`,
  {method: 'POST'},
];

export function useGroupSummary(
  group: Group,
  event: Event | null | undefined,
  project: Project
) {
  const organization = useOrganization();

  const aiConfig = useAiConfig(group, event, project);

  const queryData = useApiQuery<GroupSummaryData>(
    makeGroupSummaryQueryKey(organization.slug, group.id),
    {
      staleTime: Infinity, // Cache the result indefinitely as it's unlikely to change if it's already computed
      enabled: aiConfig.hasSummary,
    }
  );
  return {
    ...queryData,
    isPending: aiConfig.isAutofixSetupLoading || queryData.isPending,
    isError: queryData.isError,
  };
}

export function GroupSummary({
  data,
  isError,
  isPending,
  preview = false,
}: {
  data: GroupSummaryData | undefined;
  isError: boolean;
  isPending: boolean;
  preview?: boolean;
}) {
  const insightCards = [
    {
      id: 'whats_wrong',
      title: t("What's wrong"),
      insight: data?.whatsWrong,
      icon: <IconFatal size="sm" />,
    },
    {
      id: 'trace',
      title: t('In the trace'),
      insight: data?.trace,
      icon: <IconSpan size="sm" />,
    },
    {
      id: 'possible_cause',
      title: t('Possible cause'),
      insight: data?.possibleCause,
      icon: <IconFocus size="sm" />,
    },
  ];

  return (
    <div data-testid="group-summary">
      {isError ? <div>{t('Error loading summary')}</div> : null}
      <Content>
        <InsightGrid>
          {insightCards.map(card => {
            // Hide the card if we're not loading and there's no insight
            if (!isPending && !card.insight) {
              return null;
            }

            return (
              <InsightCard key={card.id}>
                <CardTitle preview={preview}>
                  <CardTitleIcon>{card.icon}</CardTitleIcon>
                  <CardTitleText>{card.title}</CardTitleText>
                </CardTitle>
                <CardContentContainer>
                  <CardLineDecorationWrapper>
                    <CardLineDecoration />
                  </CardLineDecorationWrapper>
                  {isPending ? (
                    <CardContent>
                      <Placeholder height="1.5rem" />
                    </CardContent>
                  ) : (
                    card.insight && (
                      <CardContent
                        dangerouslySetInnerHTML={{
                          __html: marked(
                            preview
                              ? card.insight.replace(/\*\*/g, '') ?? ''
                              : card.insight ?? ''
                          ),
                        }}
                      />
                    )
                  )}
                </CardContentContainer>
              </InsightCard>
            );
          })}
        </InsightGrid>
      </Content>
    </div>
  );
}

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const InsightGrid = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const InsightCard = styled('div')`
  display: flex;
  flex-direction: column;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background};
  width: 100%;
  min-height: 0;
`;

const CardTitle = styled('div')<{preview?: boolean}>`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  color: ${p => p.theme.subText};
  padding-bottom: ${space(0.5)};
`;

const CardTitleText = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const CardTitleIcon = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.subText};
`;

const CardContentContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const CardLineDecorationWrapper = styled('div')`
  display: flex;
  width: 14px;
  align-self: stretch;
  justify-content: center;
  flex-shrink: 0;
  padding: 0.275rem 0;
`;

const CardLineDecoration = styled('div')`
  width: 2px;
  align-self: stretch;
  background-color: ${p => p.theme.border};
`;

const CardContent = styled('div')`
  overflow-wrap: break-word;
  word-break: break-word;
  p {
    margin: 0;
    white-space: pre-wrap;
  }
  code {
    word-break: break-all;
  }
  flex: 1;
`;
