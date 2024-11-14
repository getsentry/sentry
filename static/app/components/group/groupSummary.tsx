import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Button} from 'sentry/components/button';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {IconChevron, IconFatal, IconFocus, IconMegaphone, IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueCategory} from 'sentry/types/group';
import marked, {singleLineRenderer} from 'sentry/utils/marked';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';

interface GroupSummaryProps {
  groupCategory: IssueCategory;
  groupId: string;
}

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

function GroupSummaryFeatureBadge() {
  return (
    <StyledFeatureBadge
      type="experimental"
      title={t(
        'This feature is experimental and may produce inaccurate results. Please share feedback to help us improve the experience.'
      )}
    />
  );
}

export function GroupSummaryBody({
  data,
  isError,
  isPending,
}: {
  data: GroupSummaryData | undefined;
  isError: boolean;
  isPending: boolean;
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
  ].filter(card => card.insight);

  return (
    <Body>
      {isError ? <div>{t('Error loading summary')}</div> : null}
      {isPending ? (
        <Content>
          <InsightGrid>
            <InsightCard>
              <Placeholder height="96px" />
            </InsightCard>
          </InsightGrid>
        </Content>
      ) : (
        data && (
          <Content>
            <InsightGrid>
              {insightCards.map(card => (
                <InsightCard key={card.id}>
                  <CardTitle>
                    <CardTitleIcon>{card.icon}</CardTitleIcon>
                    <CardTitleText>{card.title}</CardTitleText>
                  </CardTitle>
                  <CardContent
                    dangerouslySetInnerHTML={{
                      __html: marked(card.insight ?? ''),
                    }}
                  />
                </InsightCard>
              ))}
            </InsightGrid>
          </Content>
        )
      )}
    </Body>
  );
}

export function GroupSummary({groupId, groupCategory}: GroupSummaryProps) {
  const {data, isPending, isError, hasGenAIConsent} = useGroupSummary(
    groupId,
    groupCategory
  );

  const organization = useOrganization();
  const [expanded, setExpanded] = useState(false);
  const openForm = useFeedbackForm();

  if (!isSummaryEnabled(hasGenAIConsent, organization.hideAiFeatures, groupCategory)) {
    return null;
  }

  return (
    <Wrapper>
      <StyledTitleRow onClick={() => setExpanded(!data ? false : !expanded)}>
        <CollapsedRow>
          <IconContainer>
            <IconFocus />
          </IconContainer>
          {isPending && <Placeholder height="19px" width="95%" />}
          {isError ? <div>{t('Error loading summary')}</div> : null}
          {data && !expanded && (
            <Fragment>
              <HeadlinePreview
                dangerouslySetInnerHTML={{
                  __html: singleLineRenderer(`TL;DR: ${data.headline ?? ''}`),
                }}
              />
              <SummaryPreview
                dangerouslySetInnerHTML={{
                  __html: singleLineRenderer(
                    `Details: ${[data.whatsWrong, data.trace, data.possibleCause]
                      .filter(Boolean)
                      .join(' ')
                      .replaceAll('\n', ' ')
                      .replaceAll('-', '')}`
                  ),
                }}
              />
            </Fragment>
          )}
          {data && expanded && (
            <HeadlineContent
              dangerouslySetInnerHTML={{
                __html: singleLineRenderer(`TL;DR: ${data.headline ?? ''}`),
              }}
            />
          )}
        </CollapsedRow>
        <IconContainerRight>
          <IconChevron direction={expanded ? 'up' : 'down'} />
        </IconContainerRight>
      </StyledTitleRow>
      {expanded && (
        <Fragment>
          <GroupSummaryBody data={data} isError={isError} isPending={isPending} />
          {openForm && !isPending && (
            <ButtonContainer>
              <Button
                onClick={() => {
                  openForm({
                    messagePlaceholder: t(
                      'How can we make this issue summary more useful?'
                    ),
                    tags: {
                      ['feedback.source']: 'issue_details_ai_issue_summary',
                      ['feedback.owner']: 'ml-ai',
                    },
                  });
                }}
                size="xs"
                icon={<IconMegaphone />}
              >
                Give Feedback
              </Button>
              <GroupSummaryFeatureBadge />
            </ButtonContainer>
          )}
        </Fragment>
      )}
    </Wrapper>
  );
}

const Body = styled('div')`
  padding: 0 ${space(2)} ${space(0.5)} ${space(2)};
`;

const HeadlinePreview = styled('span')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: ${space(0.5)};
  flex-shrink: 0;
  max-width: 92%;
`;

const Wrapper = styled(Panel)`
  margin-bottom: ${space(1)};
  padding: ${space(0.5)};
`;

const StyledTitleRow = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: ${space(1)} ${space(1)} ${space(1)} ${space(1)};
  border-radius: ${p => p.theme.borderRadius};

  &:hover {
    cursor: pointer;
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const CollapsedRow = styled('div')`
  display: flex;
  width: 100%;
  align-items: flex-start;
  overflow: hidden;
`;

const StyledFeatureBadge = styled(FeatureBadge)``;

const HeadlineContent = styled('span')`
  overflow-wrap: break-word;
  p {
    margin: 0;
  }
  code {
    word-break: break-all;
  }
  width: 100%;
`;

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const ButtonContainer = styled('div')`
  align-items: center;
  display: flex;
  margin: ${space(1)} 0 ${space(1)} ${space(2)};
`;

const IconContainer = styled('div')`
  flex-shrink: 0;
  margin-right: ${space(1)};
  margin-top: ${space(0.25)};
  max-height: ${space(2)};
`;

const IconContainerRight = styled('div')`
  flex-shrink: 0;
  margin-left: ${space(1)};
  margin-top: ${space(0.25)};
  max-height: ${space(2)};
`;

const InsightGrid = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  margin-top: ${space(1)};
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

const SummaryPreview = styled('span')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-grow: 1;
  color: ${p => p.theme.subText};
`;

const CardTitle = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightBold};
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
  padding-left: ${space(2)};
  border-left: 3px solid ${p => p.theme.border};
  margin-left: ${space(0.5)};
  p {
    margin: 0;
    white-space: pre-wrap;
  }
  code {
    word-break: break-all;
  }
`;
