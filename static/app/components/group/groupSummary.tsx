import styled from '@emotion/styled';

import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import Placeholder from 'sentry/components/placeholder';
import {IconFatal, IconFocus, IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueCategory} from 'sentry/types/group';
import marked from 'sentry/utils/marked';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface GroupSummaryData {
  groupId: string;
  headline: string;
  possibleCause?: string | null;
  trace?: string | null;
  whatsWrong?: string | null;
}

const isSummaryEnabled = (
  hasGenAIConsent: boolean,
  hideAiFeatures: boolean,
  groupCategory: IssueCategory
) => {
  return hasGenAIConsent && !hideAiFeatures && groupCategory === IssueCategory.ERROR;
};

export const makeGroupSummaryQueryKey = (
  organizationSlug: string,
  groupId: string
): ApiQueryKey => [
  `/organizations/${organizationSlug}/issues/${groupId}/summarize/`,
  {method: 'POST'},
];

export function useGroupSummary(groupId: string, groupCategory: IssueCategory) {
  const organization = useOrganization();
  // We piggyback and use autofix's genai consent check for now.
  const {
    data: autofixSetupData,
    isPending: isAutofixSetupLoading,
    isError: isAutofixSetupError,
  } = useAutofixSetup({groupId});

  const hasGenAIConsent = autofixSetupData?.genAIConsent.ok ?? false;
  const hideAiFeatures = organization.hideAiFeatures;

  const queryData = useApiQuery<GroupSummaryData>(
    makeGroupSummaryQueryKey(organization.slug, groupId),
    {
      staleTime: Infinity, // Cache the result indefinitely as it's unlikely to change if it's already computed
      enabled: isSummaryEnabled(hasGenAIConsent, hideAiFeatures, groupCategory),
    }
  );
  return {
    ...queryData,
    isPending: isAutofixSetupLoading || queryData.isPending,
    isError: queryData.isError || isAutofixSetupError,
    hasGenAIConsent,
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
    <Body preview={preview} data-testid="group-summary">
      {isError ? <div>{t('Error loading summary')}</div> : null}
      <Content>
        <InsightGrid preview={preview}>
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
              </InsightCard>
            );
          })}
        </InsightGrid>
      </Content>
    </Body>
  );
}

const Body = styled('div')<{preview?: boolean}>`
  padding: ${p => (p.preview ? 0 : `0 ${space(2)} ${space(0.5)} ${space(2)}`)};
`;

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const InsightGrid = styled('div')<{preview?: boolean}>`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  margin-top: ${p => (p.preview ? 0 : space(1))};
`;

const InsightCard = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${space(0.5)};
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
`;

const CardTitleIcon = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.subText};
`;

const CardContent = styled('div')`
  overflow-wrap: break-word;
  word-break: break-word;
  padding-left: ${space(1.5)};
  border-left: 1px solid ${p => p.theme.border};
  margin-left: ${space(0.75)};
  p {
    margin: 0;
    white-space: pre-wrap;
  }
  code {
    word-break: break-all;
  }
`;
