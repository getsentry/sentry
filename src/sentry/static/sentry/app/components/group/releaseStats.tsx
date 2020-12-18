import React from 'react';
import styled from '@emotion/styled';

import GroupReleaseChart from 'app/components/group/releaseChart';
import SeenInfo from 'app/components/group/seenInfo';
import Placeholder from 'app/components/placeholder';
import Tooltip from 'app/components/tooltip';
import {IconQuestion} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {CurrentRelease, Environment, Group, Organization, Project} from 'app/types';
import getDynamicText from 'app/utils/getDynamicText';

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
  const orgSlug = organization.slug;
  const hasRelease = new Set(project.features).has('releases');
  const releaseTrackingUrl = `/settings/${organization.slug}/projects/${project.slug}/release-tracking/`;

  return (
    <SidebarSection title={<span data-test-id="env-label">{environmentLabel}</span>}>
      {!group || !allEnvironments ? (
        <Placeholder height="288px" />
      ) : (
        <React.Fragment>
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
              orgSlug={orgSlug}
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
              orgSlug={orgSlug}
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
        </React.Fragment>
      )}
    </SidebarSection>
  );
};

export default React.memo(GroupReleaseStats);

const TooltipWrapper = styled('span')`
  margin-left: ${space(0.5)};
`;

const StyledIconQuest = styled(IconQuestion)`
  position: relative;
  top: 2px;
`;
