import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {BarChart} from 'sentry/components/charts/barChart';
import {Count} from 'sentry/components/count';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getTitle} from 'sentry/utils/events';
import {useApiQuery} from 'sentry/utils/queryClient';

import {TeamInsightsTable} from './styles';

interface TeamIssuesAgeProps {
  organization: Organization;
  teamSlug: string;
}

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

export function TeamIssuesAge({organization, teamSlug}: TeamIssuesAgeProps) {
  const {
    data: oldestIssues,
    isPending: isOldestIssuesLoading,
    isError: isOldestIssuesError,
    refetch: refetchOldestIssues,
  } = useApiQuery<Group[]>(
    [
      getApiUrl('/teams/$organizationIdOrSlug/$teamIdOrSlug/issues/old/', {
        path: {organizationIdOrSlug: organization.slug, teamIdOrSlug: teamSlug},
      }),
      {
        query: {
          limit: 7,
        },
      },
    ],
    {staleTime: 5000}
  );

  const {
    data: unresolvedIssueAge,
    isPending: isUnresolvedIssueAgeLoading,
    isError: isUnresolvedIssueAgeError,
    refetch: refetchUnresolvedIssueAge,
  } = useApiQuery<Record<string, number>>(
    [
      getApiUrl('/teams/$organizationIdOrSlug/$teamIdOrSlug/unresolved-issue-age/', {
        path: {organizationIdOrSlug: organization.slug, teamIdOrSlug: teamSlug},
      }),
    ],
    {staleTime: 5000}
  );

  const isLoading = isOldestIssuesLoading || isUnresolvedIssueAgeLoading;

  if (isOldestIssuesError || isUnresolvedIssueAgeError) {
    return (
      <LoadingError
        onRetry={() => {
          refetchOldestIssues();
          refetchUnresolvedIssueAge();
        }}
      />
    );
  }

  const seriesData = Object.entries(unresolvedIssueAge ?? {})
    .map(([bucket, value]) => ({
      name: bucket,
      value,
    }))
    .sort((a, b) => parseBucket(b.name) - parseBucket(a.name));

  return (
    <div>
      <ChartWrapper>
        {isLoading && <Placeholder height="200px" />}
        {!isLoading && (
          <BarChart
            style={{height: 190}}
            legend={{right: 3, top: 0}}
            yAxis={{minInterval: 1}}
            xAxis={{
              type: 'category',
              min: 0,
              axisLabel: {
                showMaxLabel: true,
                showMinLabel: true,
                formatter: (bucket: string) => {
                  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
      <StyledSimpleTable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Oldest Issues')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>
              <Flex as="span" justify="end" align="center">
                {t('Events')}
              </Flex>
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>
              <Flex as="span" justify="end" align="center">
                {t('Users')}
              </Flex>
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>
              <Flex as="span" justify="end" align="center">
                {t('Age')} <IconArrow direction="down" size="xs" variant="muted" />
              </Flex>
            </SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isLoading && <SimpleTable.Loading />}
        {!isLoading && (!oldestIssues || oldestIssues.length === 0) && (
          <SimpleTable.Empty>
            {t('No unresolved issues for this team’s projects')}
          </SimpleTable.Empty>
        )}
        {!isLoading &&
          oldestIssues?.map(issue => {
            const {title} = getTitle(issue);

            return (
              <SimpleTable.Row key={issue.id}>
                <SimpleTable.RowCell>
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
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  <Count value={issue.count} />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  <Count value={issue.userCount} />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  <TimeSince date={issue.firstSeen} />
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            );
          })}
      </StyledSimpleTable>
    </div>
  );
}

const ChartWrapper = styled('div')`
  padding: ${p => p.theme.space.xl} ${p => p.theme.space.xl} 0 ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const StyledSimpleTable = styled(TeamInsightsTable)`
  grid-template-columns: 1fr 0.15fr 0.15fr 0.25fr;
`;

const ProjectTitleContainer = styled('div')`
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
`;

const TitleOverflow = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ShadowlessProjectBadge = styled(ProjectBadge)`
  display: inline-flex;
  align-items: center;
  margin-right: ${p => p.theme.space.md};

  * > img {
    box-shadow: none;
  }
`;
