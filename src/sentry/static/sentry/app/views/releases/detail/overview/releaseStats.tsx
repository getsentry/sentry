import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import {SectionHeading} from 'app/components/charts/styles';
import Count from 'app/components/count';
import DeployBadge from 'app/components/deployBadge';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import NotAvailable from 'app/components/notAvailable';
import Placeholder from 'app/components/placeholder';
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

import CrashFree from '../../list/crashFree';
import ReleaseAdoption from '../../list/releaseAdoption';
import {DisplayOption} from '../../list/utils';
import {getReleaseNewIssuesUrl, getReleaseUnhandledIssuesUrl} from '../../utils';
import {ReleaseHealthRequestRenderProps} from '../../utils/releaseHealthRequest';
import {getReleaseEventView} from '../utils';

type Props = {
  organization: Organization;
  release: Release;
  project: Required<ReleaseProject>;
  location: Location;
  selection: GlobalSelection;
  isHealthLoading: boolean;
  hasHealthData: boolean;
  getHealthData: ReleaseHealthRequestRenderProps['getHealthData'];
};

function ReleaseStats({
  organization,
  release,
  project,
  location,
  selection,
  isHealthLoading,
  hasHealthData,
  getHealthData,
}: Props) {
  const {lastDeploy, dateCreated, newGroups, version} = release;

  const crashCount = getHealthData.getCrashCount(
    version,
    project.id,
    DisplayOption.SESSIONS
  );
  const crashFreeSessions = getHealthData.getCrashFreeRate(
    version,
    project.id,
    DisplayOption.SESSIONS
  );
  const crashFreeUsers = getHealthData.getCrashFreeRate(
    version,
    project.id,
    DisplayOption.USERS
  );
  const get24hSessionCountByRelease = getHealthData.get24hCountByRelease(
    version,
    project.id,
    DisplayOption.SESSIONS
  );
  const get24hSessionCountByProject = getHealthData.get24hCountByProject(
    project.id,
    DisplayOption.SESSIONS
  );
  const get24hUserCountByRelease = getHealthData.get24hCountByRelease(
    version,
    project.id,
    DisplayOption.USERS
  );
  const get24hUserCountByProject = getHealthData.get24hCountByProject(
    project.id,
    DisplayOption.USERS
  );
  const sessionAdoption = getHealthData.getAdoption(
    version,
    project.id,
    DisplayOption.SESSIONS
  );
  const userAdoption = getHealthData.getAdoption(
    version,
    project.id,
    DisplayOption.USERS
  );

  return (
    <Container>
      <div>
        <SectionHeading>
          {lastDeploy?.dateFinished ? t('Date Deployed') : t('Date Created')}
        </SectionHeading>
        <SectionContent>
          <TimeSince date={lastDeploy?.dateFinished ?? dateCreated} />
        </SectionContent>
      </div>

      <div>
        <SectionHeading>{t('Last Deploy')}</SectionHeading>
        <SectionContent>
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
        </SectionContent>
      </div>

      <CrashFreeSection>
        <SectionHeading>
          {t('Crash Free Rate')}
          <QuestionTooltip
            position="top"
            title={getSessionTermDescription(SessionTerm.CRASH_FREE, project.platform)}
            size="sm"
          />
        </SectionHeading>
        {isHealthLoading ? (
          <Placeholder height="58px" />
        ) : (
          <SectionContent>
            {defined(crashFreeSessions) || defined(crashFreeUsers) ? (
              <CrashFreeWrapper>
                {defined(crashFreeSessions) && (
                  <div>
                    <CrashFree
                      percent={crashFreeSessions}
                      iconSize="md"
                      displayOption={DisplayOption.SESSIONS}
                    />
                  </div>
                )}

                {defined(crashFreeUsers) && (
                  <div>
                    <CrashFree
                      percent={crashFreeUsers}
                      iconSize="md"
                      displayOption={DisplayOption.USERS}
                    />
                  </div>
                )}
              </CrashFreeWrapper>
            ) : (
              <NotAvailable tooltip={NOT_AVAILABLE_MESSAGES.releaseHealth} />
            )}
          </SectionContent>
        )}
      </CrashFreeSection>

      <AdoptionSection>
        <SectionHeading>
          {t('Adoption')}
          <QuestionTooltip
            position="top"
            title={getSessionTermDescription(SessionTerm.ADOPTION, project.platform)}
            size="sm"
          />
        </SectionHeading>
        {isHealthLoading ? (
          <Placeholder height="88px" />
        ) : (
          <SectionContent>
            {get24hSessionCountByProject || get24hUserCountByProject ? (
              <AdoptionWrapper>
                {defined(get24hSessionCountByProject) &&
                  get24hSessionCountByProject > 0 && (
                    <ReleaseAdoption
                      releaseCount={get24hSessionCountByRelease ?? 0}
                      projectCount={get24hSessionCountByProject ?? 0}
                      adoption={sessionAdoption ?? 0}
                      displayOption={DisplayOption.SESSIONS}
                      withLabels
                    />
                  )}

                {defined(get24hUserCountByProject) && get24hUserCountByProject > 0 && (
                  <ReleaseAdoption
                    releaseCount={get24hUserCountByRelease ?? 0}
                    projectCount={get24hUserCountByProject ?? 0}
                    adoption={userAdoption ?? 0}
                    displayOption={DisplayOption.USERS}
                    withLabels
                  />
                )}
              </AdoptionWrapper>
            ) : (
              <NotAvailable tooltip={NOT_AVAILABLE_MESSAGES.releaseHealth} />
            )}
          </SectionContent>
        )}
      </AdoptionSection>

      <LinkedStatsSection>
        <div>
          <SectionHeading>{t('New Issues')}</SectionHeading>
          <SectionContent>
            <Tooltip title={t('Open in Issues')}>
              <GlobalSelectionLink
                to={getReleaseNewIssuesUrl(organization.slug, project.id, version)}
              >
                <Count value={newGroups} />
              </GlobalSelectionLink>
            </Tooltip>
          </SectionContent>
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
          {isHealthLoading ? (
            <Placeholder height="24px" />
          ) : (
            <SectionContent>
              {hasHealthData ? (
                <Tooltip title={t('Open in Issues')}>
                  <GlobalSelectionLink
                    to={getReleaseUnhandledIssuesUrl(
                      organization.slug,
                      project.id,
                      version
                    )}
                  >
                    <Count value={crashCount ?? 0} />
                  </GlobalSelectionLink>
                </Tooltip>
              ) : (
                <NotAvailable tooltip={NOT_AVAILABLE_MESSAGES.releaseHealth} />
              )}
            </SectionContent>
          )}
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
          <SectionContent>
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
                      if (isLoading) {
                        return <Placeholder height="24px" />;
                      }
                      if (error || !tableData || tableData.data.length === 0) {
                        return <NotAvailable />;
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
          </SectionContent>
        </div>
      </LinkedStatsSection>
    </Container>
  );
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: 50% 50%;
  grid-row-gap: ${space(2)};
  margin-bottom: ${space(3)};
`;

const SectionContent = styled('div')``;

const CrashFreeSection = styled('div')`
  grid-column: 1/3;
`;

const CrashFreeWrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
`;

const AdoptionSection = styled('div')`
  grid-column: 1/3;
  margin-bottom: ${space(1)};
`;

const AdoptionWrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
`;

const LinkedStatsSection = styled('div')`
  grid-column: 1/3;
  display: flex;
  justify-content: space-between;
`;

export default ReleaseStats;
