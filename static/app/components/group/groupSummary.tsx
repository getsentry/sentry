import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import marked from 'sentry/utils/marked';
import {useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

interface GroupSummaryProps {
  group: Group;
}

interface GroupSummaryData {
  group_id: string;
  impact: string;
  summary: string;
}

const useGroupSummary = (groupId: string) => {
  const api = useApi();

  return useQuery<GroupSummaryData>({
    queryKey: ['groupSummary', groupId],
    queryFn: () => {
      return api.requestPromise(`/issues/${groupId}/summarize/`);
    },
    staleTime: Infinity, // Cache the result indefinitely as it's unlikely to change if it's already computed
  });
};

export function GroupSummary({group}: GroupSummaryProps) {
  const {data, isLoading, error} = useGroupSummary(group.id);

  return (
    <SidebarSection.Wrap>
      <Wrapper>
        <StyledTitleRow>
          <StyledTitle>
            <span>{t('Issue Summary')}</span>
            <StyledFeatureBadge
              type="internal"
              title={tct(
                'This feature is currently only testing internally. Please let us know your feedback at [channel:#proj-issue-summary].',
                {
                  channel: <a href="https://sentry.slack.com/archives/C07GPS55GUC" />,
                }
              )}
              tooltipProps={{isHoverable: true}}
            />
          </StyledTitle>
          {isLoading && <StyledLoadingIndicator size={16} mini />}
        </StyledTitleRow>
        <StyledContent>
          {error ? <div>{t('Error loading summary')}</div> : null}
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
        </StyledContent>
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
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const StyledTitle = styled('span')`
  margin: 0;
  color: ${p => p.theme.text};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
  align-items: center;
  display: flex;
  flex-direction: row;
`;

const StyledFeatureBadge = styled(FeatureBadge)`
  margin-top: -1px;
`;

const StyledContent = styled(SidebarSection.Content)`
  margin: 0;
`;

const SummaryContent = styled('div')`
  margin: 0;
  p {
    margin: 0;
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
