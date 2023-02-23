import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment';

import AsyncComponent from 'sentry/components/asyncComponent';
import {BarChart} from 'sentry/components/charts/barChart';
import Count from 'sentry/components/count';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import PanelTable from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import TimeSince from 'sentry/components/timeSince';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Group, Organization} from 'sentry/types';
import {getTitle} from 'sentry/utils/events';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  teamSlug: string;
};

type State = AsyncComponent['state'] & {
  oldestIssues: Group[] | null;
  unresolvedIssueAge: Record<string, number> | null;
};

/**
 * takes "< 1 hour" and returns a datetime of 1 hour ago
 */
function parseBucket(bucket: string): number {
  if (bucket === '> 1 year') {
    return moment().subtract(1, 'y').subtract(1, 'd').valueOf();
  }

  const [_, num, unit] = bucket.split(' ');
  return moment()
    .subtract(num, unit as any)
    .valueOf();
}

const bucketLabels = {
  '< 1 hour': t('1 hour'),
  '< 4 hour': t('4 hours'),
  '< 12 hour': t('12 hours'),
  '< 1 day': t('1 day'),
  '< 1 week': t('1 week'),
  '< 4 week': t('1 month'),
  '< 24 week': t('6 months'),
  '< 1 year': t('1 year'),
  '> 1 year': t('> 1 year'),
};

class TeamIssuesAge extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      oldestIssues: null,
      unresolvedIssueAge: null,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, teamSlug} = this.props;

    return [
      [
        'oldestIssues',
        `/teams/${organization.slug}/${teamSlug}/issues/old/`,
        {query: {limit: 7}},
      ],
      [
        'unresolvedIssueAge',
        `/teams/${organization.slug}/${teamSlug}/unresolved-issue-age/`,
      ],
    ];
  }

  componentDidUpdate(prevProps: Props) {
    const {teamSlug} = this.props;

    if (prevProps.teamSlug !== teamSlug) {
      this.remountComponent();
    }
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {organization} = this.props;
    const {unresolvedIssueAge, oldestIssues, loading} = this.state;

    const seriesData = Object.entries(unresolvedIssueAge ?? {})
      .map(([bucket, value]) => ({
        name: bucket,
        value,
      }))
      .sort((a, b) => parseBucket(b.name) - parseBucket(a.name));

    return (
      <div>
        <ChartWrapper>
          {loading && <Placeholder height="200px" />}
          {!loading && (
            <BarChart
              style={{height: 190}}
              legend={{right: 3, top: 0}}
              yAxis={{minInterval: 1}}
              xAxis={{
                splitNumber: seriesData.length,
                type: 'category',
                min: 0,
                axisLabel: {
                  showMaxLabel: true,
                  showMinLabel: true,
                  formatter: (bucket: string) => {
                    return bucketLabels[bucket] ?? bucket;
                  },
                },
              }}
              series={[
                {
                  seriesName: t('Unresolved Issues'),
                  silent: true,
                  data: seriesData,
                  barCategoryGap: '5%',
                },
              ]}
            />
          )}
        </ChartWrapper>
        <StyledPanelTable
          isEmpty={!oldestIssues || oldestIssues.length === 0}
          emptyMessage={t('No unresolved issues for this team’s projects')}
          headers={[
            t('Oldest Issues'),
            <RightAligned key="events">{t('Events')}</RightAligned>,
            <RightAligned key="users">{t('Users')}</RightAligned>,
            <RightAligned key="age">
              {t('Age')} <IconArrow direction="down" size="xs" color="gray300" />
            </RightAligned>,
          ]}
          isLoading={loading}
        >
          {oldestIssues?.map(issue => {
            const {title} = getTitle(issue, organization?.features, false);

            return (
              <Fragment key={issue.id}>
                <ProjectTitleContainer>
                  <ShadowlessProjectBadge
                    disableLink
                    hideName
                    avatarSize={18}
                    project={issue.project}
                  />
                  <TitleOverflow>
                    <Link
                      to={{
                        pathname: `/organizations/${organization.slug}/issues/${issue.id}/`,
                      }}
                    >
                      {title}
                    </Link>
                  </TitleOverflow>
                </ProjectTitleContainer>
                <RightAligned>
                  <Count value={issue.count} />
                </RightAligned>
                <RightAligned>
                  <Count value={issue.userCount} />
                </RightAligned>
                <RightAligned>
                  <TimeSince date={issue.firstSeen} />
                </RightAligned>
              </Fragment>
            );
          })}
        </StyledPanelTable>
      </div>
    );
  }
}

export default TeamIssuesAge;

const ChartWrapper = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 0.15fr 0.15fr 0.25fr;
  white-space: nowrap;
  margin-bottom: 0;
  border: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  box-shadow: unset;

  > * {
    padding: ${space(1)} ${space(2)};
  }

  ${p =>
    p.isEmpty &&
    css`
      & > div:last-child {
        padding: 48px ${space(2)};
      }
    `}
`;

const RightAligned = styled('span')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const ProjectTitleContainer = styled('div')`
  ${p => p.theme.overflowEllipsis};
  display: flex;
  align-items: center;
`;

const TitleOverflow = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;

const ShadowlessProjectBadge = styled(ProjectBadge)`
  display: inline-flex;
  align-items: center;
  margin-right: ${space(1)};

  * > img {
    box-shadow: none;
  }
`;
