import {Fragment, memo} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {openAddDashboardWidgetModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import GroupReleaseChart from 'sentry/components/group/releaseChart';
import SeenInfo from 'sentry/components/group/seenInfo';
import Placeholder from 'sentry/components/placeholder';
import Tooltip from 'sentry/components/tooltip';
import {IconAdd, IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {CurrentRelease, Environment, Group, Organization, Project} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import {DashboardWidgetSource, DisplayType} from 'sentry/views/dashboardsV2/types';

import SidebarSection from './sidebarSection';

type Props = {
  organization: Organization;
  project: Project;
  environments: Environment[];
  allEnvironments: Group | undefined;
  group: Group | undefined;
  currentRelease: CurrentRelease | undefined;
};

const GroupReleaseStats = ({
  organization,
  project,
  environments,
  allEnvironments,
  group,
  currentRelease,
}: Props) => {
  const environmentLabel =
    environments.length > 0
      ? environments.map(env => env.displayName).join(', ')
      : t('All Environments');

  const shortEnvironmentLabel =
    environments.length > 1
      ? t('selected environments')
      : environments.length === 1
      ? environments[0].displayName
      : undefined;

  const projectId = project.id;
  const projectSlug = project.slug;
  const hasRelease = new Set(project.features).has('releases');
  const releaseTrackingUrl = `/settings/${organization.slug}/projects/${project.slug}/release-tracking/`;

  const time30dAgo = moment().subtract(30, 'days');
  const time24hrsAgo = moment().subtract(24, 'hours');

  const generateGroupReleaseChartTitle = (title: string, startTime: moment.Moment) => {
    const handleAddToDashboard = () => {
      group &&
        openAddDashboardWidgetModal({
          organization,
          widget: {
            title: group.title,
            displayType: DisplayType.AREA,
            interval: '1h',
            queries: [
              {
                name: '',
                fields: ['count()'],
                conditions: `issue.id:${group.id}`,
                orderby: '',
              },
            ],
          },
          start: startTime.toDate().toString(),
          end: moment().toDate().toString(),
          source: DashboardWidgetSource.ISSUE_DETAILS,
        });
    };

    return (
      <Feature
        features={[
          'organizations:create-dashboard-widget-from-issue',
          'organizations:dashboards-edit',
        ]}
        organization={organization}
        renderDisabled={() => title}
      >
        <GroupReleaseChartWrapper>
          <span>{title}</span>
          <AddToDashboard onClick={handleAddToDashboard}>
            <IconAdd size="9px" />
            {t('Add to Dashboard')}
          </AddToDashboard>
        </GroupReleaseChartWrapper>
      </Feature>
    );
  };

  return (
    <SidebarSection title={<span data-test-id="env-label">{environmentLabel}</span>}>
      {!group || !allEnvironments ? (
        <Placeholder height="288px" />
      ) : (
        <Fragment>
          <GroupReleaseChart
            group={allEnvironments}
            environment={environmentLabel}
            environmentStats={group.stats}
            release={currentRelease?.release}
            releaseStats={currentRelease?.stats}
            statsPeriod="24h"
            title={generateGroupReleaseChartTitle(t('Last 24 Hours'), time24hrsAgo)}
            firstSeen={group.firstSeen}
            lastSeen={group.lastSeen}
          />
          <GroupReleaseChart
            group={allEnvironments}
            environment={environmentLabel}
            environmentStats={group.stats}
            release={currentRelease?.release}
            releaseStats={currentRelease?.stats}
            statsPeriod="30d"
            title={generateGroupReleaseChartTitle(t('Last 30 Days'), time30dAgo)}
            className="bar-chart-small"
            firstSeen={group.firstSeen}
            lastSeen={group.lastSeen}
          />

          <SidebarSection
            secondary
            title={
              <span>
                {t('Last seen')}
                <TooltipWrapper>
                  <Tooltip
                    title={t('When the most recent event in this issue was captured.')}
                    disableForVisualTest
                  >
                    <StyledIconQuest size="xs" color="gray200" />
                  </Tooltip>
                </TooltipWrapper>
              </span>
            }
          >
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
              release={group.lastRelease || null}
              title={t('Last seen')}
            />
          </SidebarSection>

          <SidebarSection
            secondary
            title={
              <span>
                {t('First seen')}
                <TooltipWrapper>
                  <Tooltip
                    title={t('When the first event in this issue was captured.')}
                    disableForVisualTest
                  >
                    <StyledIconQuest size="xs" color="gray200" />
                  </Tooltip>
                </TooltipWrapper>
              </span>
            }
          >
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
              release={group.firstRelease || null}
              title={t('First seen')}
            />
          </SidebarSection>
          {!hasRelease ? (
            <SidebarSection secondary title={t('Releases not configured')}>
              <a href={releaseTrackingUrl}>{t('Setup Releases')}</a>{' '}
              {t(' to make issues easier to fix.')}
            </SidebarSection>
          ) : null}
        </Fragment>
      )}
    </SidebarSection>
  );
};

export default memo(GroupReleaseStats);

const TooltipWrapper = styled('span')`
  margin-left: ${space(0.5)};
`;

const StyledIconQuest = styled(IconQuestion)`
  position: relative;
  top: 2px;
`;

const GroupReleaseChartWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  width: 100%;
`;

const AddToDashboard = styled('span')`
  color: ${p => p.theme.blue300};
  display: grid;
  vertical-align: baseline;
  grid-auto-flow: column;
  align-items: center;
`;

const InnerTitleWrapper = styled('span')`
  margin: auto;
`;
