import {Fragment, memo} from 'react';
import styled from '@emotion/styled';

import AlertLink from 'sentry/components/alertLink';
import GroupReleaseChart from 'sentry/components/group/releaseChart';
import SeenInfo from 'sentry/components/group/seenInfo';
import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {CurrentRelease, Group, Organization, Project, Release} from 'sentry/types';
import {defined} from 'sentry/utils';
import getDynamicText from 'sentry/utils/getDynamicText';
import {useApiQuery} from 'sentry/utils/queryClient';

import QuestionTooltip from '../questionTooltip';

type Props = {
  environments: string[];
  organization: Organization;
  project: Project;
  allEnvironments?: Group;
  currentRelease?: CurrentRelease;
  group?: Group;
};

type GroupRelease = {
  firstRelease: Release;
  lastRelease: Release;
};

function GroupReleaseStats({
  organization,
  project,
  environments,
  allEnvironments,
  group,
  currentRelease,
}: Props) {
  const environment = environments.length > 0 ? environments.join(', ') : undefined;
  const environmentLabel = environment ? environment : t('All Environments');

  const shortEnvironmentLabel =
    environments.length > 1
      ? t('selected environments')
      : environments.length === 1
      ? environments[0]
      : undefined;

  const {data: groupReleaseData} = useApiQuery<GroupRelease>(
    [
      defined(group)
        ? `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`
        : '',
    ],
    {
      staleTime: 30000,
      cacheTime: 30000,
    }
  );

  const firstRelease = groupReleaseData?.firstRelease;
  const lastRelease = groupReleaseData?.lastRelease;

  const projectId = project.id;
  const projectSlug = project.slug;
  const hasRelease = project.features.includes('releases');
  const releaseTrackingUrl = `/settings/${organization.slug}/projects/${project.slug}/release-tracking/`;

  return (
    <div>
      {!group || !allEnvironments ? (
        <Placeholder height="346px" bottomGutter={4} />
      ) : (
        <Fragment>
          <GraphContainer>
            <GroupReleaseChart
              group={allEnvironments}
              environment={environment}
              environmentLabel={environmentLabel}
              environmentStats={group.stats}
              release={currentRelease?.release}
              releaseStats={currentRelease?.stats}
              statsPeriod="24h"
              title={t('Last 24 Hours')}
              firstSeen={group.firstSeen}
              lastSeen={group.lastSeen}
            />
          </GraphContainer>
          <GraphContainer>
            <GroupReleaseChart
              group={allEnvironments}
              environment={environment}
              environmentLabel={environmentLabel}
              environmentStats={group.stats}
              release={currentRelease?.release}
              releaseStats={currentRelease?.stats}
              statsPeriod="30d"
              title={t('Last 30 Days')}
              className="bar-chart-small"
              firstSeen={group.firstSeen}
              lastSeen={group.lastSeen}
            />
          </GraphContainer>

          <SidebarSection.Wrap>
            <SidebarSection.Title>
              {t('Last Seen')}
              <QuestionTooltip
                title={t('When the most recent event in this issue was captured.')}
                size="xs"
              />
            </SidebarSection.Title>
            <StyledSidebarSectionContent>
              <SeenInfo
                organization={organization}
                projectId={projectId}
                projectSlug={projectSlug}
                date={getDynamicText({
                  value: group.lastSeen,
                  fixed: '2016-01-13T03:08:25Z',
                })}
                dateGlobal={allEnvironments.lastSeen}
                hasRelease={hasRelease}
                environment={shortEnvironmentLabel}
                release={lastRelease}
                title={t('Last Seen')}
              />
            </StyledSidebarSectionContent>
          </SidebarSection.Wrap>
          <SidebarSection.Wrap>
            <SidebarSection.Title>
              {t('First Seen')}
              <QuestionTooltip
                title={t('When the first event in this issue was captured.')}
                size="xs"
              />
            </SidebarSection.Title>
            <StyledSidebarSectionContent>
              <SeenInfo
                organization={organization}
                projectId={projectId}
                projectSlug={projectSlug}
                date={getDynamicText({
                  value: group.firstSeen,
                  fixed: '2015-08-13T03:08:25Z',
                })}
                dateGlobal={allEnvironments.firstSeen}
                hasRelease={hasRelease}
                environment={shortEnvironmentLabel}
                release={firstRelease}
                title={t('First seen')}
              />
            </StyledSidebarSectionContent>
          </SidebarSection.Wrap>
          {!hasRelease ? (
            <SidebarSection.Wrap>
              <SidebarSection.Title>{t('Releases')}</SidebarSection.Title>
              <SidebarSection.Content>
                <AlertLink priority="muted" size="small" to={releaseTrackingUrl}>
                  {t('See which release caused this issue ')}
                </AlertLink>
              </SidebarSection.Content>
            </SidebarSection.Wrap>
          ) : null}
        </Fragment>
      )}
    </div>
  );
}

export default memo(GroupReleaseStats);

const GraphContainer = styled('div')`
  margin-bottom: ${space(3)};
`;

const StyledSidebarSectionContent = styled(SidebarSection.Content)`
  margin-top: ${space(0.5)};
`;
