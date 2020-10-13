import React from 'react';

import LoadingIndicator from 'app/components/loadingIndicator';
import GroupReleaseChart from 'app/components/group/releaseChart';
import SeenInfo from 'app/components/group/seenInfo';
import getDynamicText from 'app/utils/getDynamicText';
import {t} from 'app/locale';
import {Environment, Group, Organization, Project} from 'app/types';

type Props = {
  organization: Organization;
  project: Project;
  environments: Environment[];
  allEnvironments: Group | undefined;
  group: Group | undefined;
};

const GroupReleaseStats = ({
  group,
  organization,
  project,
  environments,
  allEnvironments,
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

  return (
    <div className="env-stats">
      <h6>
        <span data-test-id="env-label">{environmentLabel}</span>
      </h6>

      <div className="env-content">
        {!group || !allEnvironments ? (
          <LoadingIndicator />
        ) : (
          <React.Fragment>
            <GroupReleaseChart
              group={allEnvironments}
              environment={environmentLabel}
              environmentStats={group.stats}
              release={group.currentRelease ? group.currentRelease.release : null}
              releaseStats={group.currentRelease ? group.currentRelease.stats : null}
              statsPeriod="24h"
              title={t('Last 24 Hours')}
              firstSeen={group.firstSeen}
              lastSeen={group.lastSeen}
            />
            <GroupReleaseChart
              group={allEnvironments}
              environment={environmentLabel}
              environmentStats={group.stats}
              release={group.currentRelease ? group.currentRelease.release : null}
              releaseStats={group.currentRelease ? group.currentRelease.stats : null}
              statsPeriod="30d"
              title={t('Last 30 Days')}
              className="bar-chart-small"
              firstSeen={group.firstSeen}
              lastSeen={group.lastSeen}
            />
            <h6>
              <span>{t('First seen')}</span>
              {environments.length > 0 && <small>({environmentLabel})</small>}
            </h6>

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

            <h6>
              <span>{t('Last seen')}</span>
              {environments.length > 0 && <small>({environmentLabel})</small>}
            </h6>
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
          </React.Fragment>
        )}
      </div>
    </div>
  );
};

export default React.memo(GroupReleaseStats);
