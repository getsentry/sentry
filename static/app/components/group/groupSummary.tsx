import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Button} from 'sentry/components/button';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueCategory} from 'sentry/types/group';
import marked from 'sentry/utils/marked';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

interface GroupSummaryProps {
  groupCategory: IssueCategory;
  groupId: string;
}

interface GroupSummaryData {
  groupId: string;
  impact: string;
  summary: string;
  headline?: string;
}

const isSummaryEnabled = (hasGenAIConsent: boolean, groupCategory: IssueCategory) => {
  return hasGenAIConsent && groupCategory === IssueCategory.ERROR;
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

  const queryData = useApiQuery<GroupSummaryData>(
    makeGroupSummaryQueryKey(organization.slug, groupId),
    {
      staleTime: Infinity, // Cache the result indefinitely as it's unlikely to change if it's already computed
      enabled: isSummaryEnabled(hasGenAIConsent, groupCategory),
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

export function GroupSummaryHeader({groupId, groupCategory}: GroupSummaryProps) {
  const {data, isPending, isError, hasGenAIConsent} = useGroupSummary(
    groupId,
    groupCategory
  );
  const isStreamlined = useHasStreamlinedUI();

  if (
    isError ||
    (!isPending && !data?.headline) ||
    !isSummaryEnabled(hasGenAIConsent, groupCategory)
  ) {
    // Don't render the summary headline if there's an error, the error is already shown in the sidebar
    // If there is no headline we also don't want to render anything
    return null;
  }

  const renderContent = () => {
    if (isPending) {
      return <Placeholder height="19px" width="256px" />;
    }

    return <span>{data?.headline}</span>;
  };

  return (
    <SummaryHeaderContainer isStreamlined={isStreamlined}>
      {renderContent()}
      <GroupSummaryFeatureBadge />
    </SummaryHeaderContainer>
  );
}

export function GroupSummary({groupId, groupCategory}: GroupSummaryProps) {
  const {data, isPending, isError, hasGenAIConsent} = useGroupSummary(
    groupId,
    groupCategory
  );

  const openForm = useFeedbackForm();

  if (!isSummaryEnabled(hasGenAIConsent, groupCategory)) {
    // TODO: Render a banner for needing genai consent
    return null;
  }

  return (
    <SidebarSection.Wrap>
      <Wrapper>
        <StyledTitleRow>
          <StyledTitle>
            <span>{t('Issue Summary')}</span>
            <GroupSummaryFeatureBadge />
          </StyledTitle>
          {isPending && <StyledLoadingIndicator size={16} mini />}
        </StyledTitleRow>
        <div>
          {isError ? <div>{t('Error loading summary')}</div> : null}
          {data && (
            <Content>
              <SummaryContent
                dangerouslySetInnerHTML={{
                  __html: marked(data.summary),
                }}
              />
              <ImpactContent>
                <StyledTitle>{t('Potential Impact')}</StyledTitle>
                <SummaryContent
                  dangerouslySetInnerHTML={{
                    __html: marked(data.impact),
                  }}
                />
              </ImpactContent>
            </Content>
          )}
        </div>
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
          </ButtonContainer>
        )}
      </Wrapper>
    </SidebarSection.Wrap>
  );
}

const Wrapper = styled(Panel)`
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
  background: linear-gradient(
    269.35deg,
    ${p => p.theme.backgroundTertiary} 0.32%,
    rgba(245, 243, 247, 0) 99.69%
  );
  padding: ${space(1.5)} ${space(2)};
`;

const StyledTitleRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StyledTitle = styled('div')`
  margin: 0;
  color: ${p => p.theme.text};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
  align-items: center;
  display: flex;
`;

const StyledFeatureBadge = styled(FeatureBadge)`
  margin-top: -1px;
`;

const SummaryContent = styled('div')`
  overflow-wrap: break-word;
  p {
    margin: 0;
  }
  code {
    word-break: break-all;
  }
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  max-height: 16px;
`;

const ImpactContent = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const ButtonContainer = styled('div')`
  margin-top: ${space(1.5)};
  margin-bottom: ${space(0.5)};
`;

const SummaryHeaderContainer = styled('div')<{isStreamlined: boolean}>`
  display: flex;
  align-items: center;
  margin-top: ${space(1)};
  color: ${p => (p.isStreamlined ? p.theme.subText : p.theme.text)};
`;
