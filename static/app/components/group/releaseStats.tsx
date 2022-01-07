import {Fragment, memo} from 'react';
import styled from '@emotion/styled';

import GroupReleaseChart from 'sentry/components/group/releaseChart';
import SeenInfo from 'sentry/components/group/seenInfo';
import Placeholder from 'sentry/components/placeholder';
import Tooltip from 'sentry/components/tooltip';
import {IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {CurrentRelease, Environment, Group, Organization, Project} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';

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
            title={t('Last 24 Hours')}
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
            title={t('Last 30 Days')}
            className="bar-chart-small"
            firstSeen={group.firstSeen}
            lastSeen={group.lastSeen}
          />

          <SidebarSection
            secondary
            title={
              <Fragment>
                {t('Last seen')}
                <TooltipWrapper>
                  <Tooltip
                    title={t('When the most recent event in this issue was captured.')}
                    disableForVisualTest
                  >
                    <IconQuestion size="xs" color="gray200" />
                  </Tooltip>
                </TooltipWrapper>
              </Fragment>
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
              <Fragment>
                {t('First seen')}
                <TooltipWrapper>
                  <Tooltip
                    title={t('When the first event in this issue was captured.')}
                    disableForVisualTest
                  >
                    <IconQuestion size="xs" color="gray200" />
                  </Tooltip>
                </TooltipWrapper>
              </Fragment>
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
