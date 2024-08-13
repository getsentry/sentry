import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import marked from 'sentry/utils/marked';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface GroupSummaryProps {
  groupId: string;
}

interface GroupSummaryData {
  groupId: string;
  impact: string;
  summary: string;
}

const makeGroupSummaryQueryKey = (
  organizationSlug: string,
  groupId: string
): ApiQueryKey => [`/organizations/${organizationSlug}/issues/${groupId}/summarize/`];

export function GroupSummary({groupId}: GroupSummaryProps) {
  const organization = useOrganization();
  const {data, isLoading, error} = useApiQuery<GroupSummaryData>(
    makeGroupSummaryQueryKey(organization.slug, groupId),
    {
      staleTime: Infinity, // Cache the result indefinitely as it's unlikely to change if it's already computed
    }
  );

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
        <div>
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
        </div>
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
