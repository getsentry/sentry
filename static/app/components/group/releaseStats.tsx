import {Fragment, memo} from 'react';
import styled from '@emotion/styled';

import AlertLink from 'sentry/components/alertLink';
import GroupReleaseChart from 'sentry/components/group/releaseChart';
import SeenInfo from 'sentry/components/group/seenInfo';
import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {Tooltip} from 'sentry/components/tooltip';
import {IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {CurrentRelease, Environment, Group, Organization, Project} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';

type Props = {
  allEnvironments: Group | undefined;
  currentRelease: CurrentRelease | undefined;
  environments: Environment[];
  group: Group | undefined;
  organization: Organization;
  project: Project;
};

function GroupReleaseStats({
  organization,
  project,
  environments,
  allEnvironments,
  group,
  currentRelease,
}: Props) {
  const environment =
    environments.length > 0
      ? environments.map(env => env.displayName).join(', ')
      : undefined;
  const environmentLabel = environment ? environment : t('All Environments');

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
              <Fragment>
                {t('Last Seen')}
                <TooltipWrapper>
                  <Tooltip
                    title={t('When the most recent event in this issue was captured.')}
                    disableForVisualTest
                  >
                    <IconQuestion size="sm" color="gray200" />
                  </Tooltip>
                </TooltipWrapper>
              </Fragment>
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
                release={group.lastRelease || null}
                title={t('Last Seen')}
              />
            </StyledSidebarSectionContent>
          </SidebarSection.Wrap>
          <SidebarSection.Wrap>
            <SidebarSection.Title>
              <Fragment>
                {t('First Seen')}
                <TooltipWrapper>
                  <Tooltip
                    title={t('When the first event in this issue was captured.')}
                    disableForVisualTest
                  >
                    <IconQuestion size="sm" color="gray200" />
                  </Tooltip>
                </TooltipWrapper>
              </Fragment>
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
                release={group.firstRelease || null}
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

const TooltipWrapper = styled('span')`
  margin-left: ${space(0.5)};
`;

const GraphContainer = styled('div')`
  margin-bottom: ${space(3)};
`;

const StyledSidebarSectionContent = styled(SidebarSection.Content)`
  margin-top: ${space(0.5)};
`;
