import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Button} from 'sentry/components/button';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {IconChevron, IconFocus, IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueCategory} from 'sentry/types/group';
import marked, {singleLineRenderer} from 'sentry/utils/marked';
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

export function GroupSummary({groupId, groupCategory}: GroupSummaryProps) {
  const {data, isPending, isError, hasGenAIConsent} = useGroupSummary(
    groupId,
    groupCategory
  );

  const [expanded, setExpanded] = useState(false);

  const openForm = useFeedbackForm();

  const isStreamlined = useHasStreamlinedUI();

  if (!isSummaryEnabled(hasGenAIConsent, groupCategory)) {
    // TODO: Render a banner for needing genai consent
    return null;
  }

  return (
    <Wrapper isStreamlined={isStreamlined}>
      <StyledTitleRow onClick={() => setExpanded(!data ? false : !expanded)}>
        <CollapsedRow>
          <IconContainer>
            <IconFocus />
          </IconContainer>
          {isPending && <Placeholder height="19px" width="95%" />}
          {isError ? <div>{t('Error loading summary')}</div> : null}
          {data && !expanded && (
            <Fragment>
              <HeadlinePreview>{data.headline}</HeadlinePreview>
              <SummaryPreview
                dangerouslySetInnerHTML={{
                  __html: singleLineRenderer(
                    `Details: ${data.summary.replaceAll('\n', ' ').replaceAll('-', '')}`
                  ),
                }}
              />
            </Fragment>
          )}
          {data && expanded && <HeadlineContent>{data.headline}</HeadlineContent>}
        </CollapsedRow>
        <IconContainerRight>
          <IconChevron direction={expanded ? 'up' : 'down'} />
        </IconContainerRight>
      </StyledTitleRow>
      {expanded && (
        <Body>
          {isError ? <div>{t('Error loading summary')}</div> : null}
          {data && (
            <Content>
              <SummaryContent
                dangerouslySetInnerHTML={{
                  __html: marked(data.summary),
                }}
              />
            </Content>
          )}
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
        </Body>
      )}
    </Wrapper>
  );
}

const Body = styled('div')`
  padding: 0 ${space(4)} ${space(1.5)} ${space(4)};
`;

const HeadlinePreview = styled('span')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: ${space(0.5)};
  flex-shrink: 0;
  max-width: 92%;
`;

const SummaryPreview = styled('span')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-grow: 1;
  color: ${p => p.theme.subText};
`;

const Wrapper = styled(Panel)<{isStreamlined: boolean}>`
  margin-bottom: ${p => (p.isStreamlined ? 0 : space(1))};
  padding: ${space(0.5)};
`;

const StyledTitleRow = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: ${space(1)} ${space(1)} ${space(1)} ${space(1)};

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

const SummaryContent = styled('div')`
  overflow-wrap: break-word;
  p {
    margin: 0;
  }
  code {
    word-break: break-all;
  }
`;

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const ButtonContainer = styled('div')`
  align-items: center;
  display: flex;
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
