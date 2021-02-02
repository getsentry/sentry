import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import {SectionHeading} from 'app/components/charts/styles';
import Count from 'app/components/count';
import DeployBadge from 'app/components/deployBadge';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import NotAvailable from 'app/components/notAvailable';
import ProgressBar from 'app/components/progressBar';
import QuestionTooltip from 'app/components/questionTooltip';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import NOT_AVAILABLE_MESSAGES from 'app/constants/notAvailableMessages';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization, Release, ReleaseProject} from 'app/types';
import {defined} from 'app/utils';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {getTermHelp, PERFORMANCE_TERM} from 'app/views/performance/data';
import {
  getSessionTermDescription,
  SessionTerm,
  sessionTerm,
} from 'app/views/releases/utils/sessionTerm';

import AdoptionTooltip from '../../list/adoptionTooltip';
import CrashFree from '../../list/crashFree';
import {getReleaseNewIssuesUrl, getReleaseUnhandledIssuesUrl} from '../../utils';
import {getReleaseEventView} from '../utils';

type Props = {
  organization: Organization;
  release: Release;
  project: Required<ReleaseProject>;
  location: Location;
  selection: GlobalSelection;
};

function ReleaseStats({organization, release, project, location, selection}: Props) {
  const {lastDeploy, dateCreated, newGroups, version} = release;
  const {hasHealthData, healthData} = project;
  const {
    sessionsCrashed,
    adoption,
    crashFreeUsers,
    crashFreeSessions,
    totalUsers,
    totalUsers24h,
    totalSessions,
    totalSessions24h,
  } = healthData;

  return (
    <Container>
      <div>
        <SectionHeading>
          {lastDeploy?.dateFinished ? t('Date Deployed') : t('Date Created')}
        </SectionHeading>
        <div>
          <TimeSince date={lastDeploy?.dateFinished ?? dateCreated} />
        </div>
      </div>

      <div>
        <SectionHeading>{t('Last Deploy')}</SectionHeading>
        <div>
          {lastDeploy?.dateFinished ? (
            <DeployBadge
              deploy={lastDeploy}
              orgSlug={organization.slug}
              version={version}
              projectId={project.id}
            />
          ) : (
            <NotAvailable />
          )}
        </div>
      </div>

      <div>
        <SectionHeading>{t('Crash Free Users')}</SectionHeading>
        <div>
          {defined(crashFreeUsers) ? (
            <CrashFree percent={crashFreeUsers} iconSize="md" />
          ) : (
            <NotAvailable tooltip={NOT_AVAILABLE_MESSAGES.releaseHealth} />
          )}
        </div>
      </div>

      <div>
        <SectionHeading>{t('Crash Free Sessions')}</SectionHeading>
        <div>
          {defined(crashFreeSessions) ? (
            <CrashFree percent={crashFreeSessions} iconSize="md" />
          ) : (
            <NotAvailable tooltip={NOT_AVAILABLE_MESSAGES.releaseHealth} />
          )}
        </div>
      </div>

      <AdoptionWrapper>
        <SectionHeading>{t('User Adoption')}</SectionHeading>
        {defined(adoption) ? (
          <Tooltip
            containerDisplayMode="block"
            title={
              <AdoptionTooltip
                totalUsers={totalUsers}
                totalSessions={totalSessions}
                totalUsers24h={totalUsers24h}
                totalSessions24h={totalSessions24h}
              />
            }
          >
            <ProgressBar value={Math.ceil(adoption)} />
          </Tooltip>
        ) : (
          <NotAvailable tooltip={NOT_AVAILABLE_MESSAGES.releaseHealth} />
        )}
      </AdoptionWrapper>

      <LinkedStatsWrapper>
        <div>
          <SectionHeading>{t('New Issues')}</SectionHeading>
          <div>
            <Tooltip title={t('Open in Issues')}>
              <GlobalSelectionLink
                to={getReleaseNewIssuesUrl(organization.slug, project.id, version)}
              >
                <Count value={newGroups} />
              </GlobalSelectionLink>
            </Tooltip>
          </div>
        </div>

        <div>
          <SectionHeading>
            {sessionTerm.crashes}
            <QuestionTooltip
              position="top"
              title={getSessionTermDescription(SessionTerm.CRASHES, project.platform)}
              size="sm"
            />
          </SectionHeading>
          <div>
            {hasHealthData ? (
              <Tooltip title={t('Open in Issues')}>
                <GlobalSelectionLink
                  to={getReleaseUnhandledIssuesUrl(
                    organization.slug,
                    project.id,
                    version
                  )}
                >
                  <Count value={sessionsCrashed} />
                </GlobalSelectionLink>
              </Tooltip>
            ) : (
              <NotAvailable tooltip={NOT_AVAILABLE_MESSAGES.releaseHealth} />
            )}
          </div>
        </div>

        <div>
          <SectionHeading>
            {t('Apdex')}
            <QuestionTooltip
              position="top"
              title={getTermHelp(organization, PERFORMANCE_TERM.APDEX)}
              size="sm"
            />
          </SectionHeading>
          <div>
            <Feature features={['performance-view']}>
              {hasFeature =>
                hasFeature ? (
                  <DiscoverQuery
                    eventView={getReleaseEventView(
                      selection,
                      release?.version,
                      organization
                    )}
                    location={location}
                    orgSlug={organization.slug}
                  >
                    {({isLoading, error, tableData}) => {
                      if (
                        isLoading ||
                        error ||
                        !tableData ||
                        tableData.data.length === 0
                      ) {
                        return '\u2014';
                      }
                      return (
                        <GlobalSelectionLink
                          to={{
                            pathname: `/organizations/${organization.slug}/performance/`,
                            query: {
                              query: `release:${release?.version}`,
                            },
                          }}
                        >
                          <Tooltip title={t('Open in Performance')}>
                            <Count
                              value={
                                tableData.data[0][
                                  getAggregateAlias(
                                    `apdex(${organization.apdexThreshold})`
                                  )
                                ]
                              }
                            />
                          </Tooltip>
                        </GlobalSelectionLink>
                      );
                    }}
                  </DiscoverQuery>
                ) : (
                  <NotAvailable tooltip={NOT_AVAILABLE_MESSAGES.performance} />
                )
              }
            </Feature>
          </div>
        </div>
      </LinkedStatsWrapper>
    </Container>
  );
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: 50% 50%;
  grid-row-gap: ${space(2)};
  margin-bottom: ${space(3)};
`;

const LinkedStatsWrapper = styled('div')`
  grid-column: 1/3;
  display: flex;
  justify-content: space-between;
`;

const AdoptionWrapper = styled('div')`
  grid-column: 1/3;
`;

export default ReleaseStats;
