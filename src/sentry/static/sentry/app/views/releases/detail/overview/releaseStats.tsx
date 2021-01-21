import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import {SectionHeading} from 'app/components/charts/styles';
import Count from 'app/components/count';
import DeployBadge from 'app/components/deployBadge';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import QuestionTooltip from 'app/components/questionTooltip';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization, Release, ReleaseProject} from 'app/types';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {getTermHelp} from 'app/views/performance/data';
import {
  getSessionTermDescription,
  SessionTerm,
  sessionTerm,
} from 'app/views/releases/utils/sessionTerm';

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
  const {hasHealthData} = project;
  const {sessionsCrashed} = project.healthData;

  return (
    <Container>
      <DateStatWrapper>
        <SectionHeading>
          {lastDeploy?.dateFinished ? t('Date Deployed') : t('Date Created')}
        </SectionHeading>
        <div>
          <TimeSince date={lastDeploy?.dateFinished ?? dateCreated} />
        </div>
      </DateStatWrapper>

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
            '\u2014'
          )}
        </div>
      </div>

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
          {t('Apdex')}
          <QuestionTooltip
            position="top"
            title={getTermHelp(organization, 'apdex')}
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
                    if (isLoading || error || !tableData || tableData.data.length === 0) {
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
                        <Count
                          value={
                            tableData.data[0][
                              getAggregateAlias(`apdex(${organization.apdexThreshold})`)
                            ]
                          }
                        />
                      </GlobalSelectionLink>
                    );
                  }}
                </DiscoverQuery>
              ) : (
                <Tooltip
                  title={t('This view is only available with Performance Monitoring.')}
                >
                  {'\u2014'}
                </Tooltip>
              )
            }
          </Feature>
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
                to={getReleaseUnhandledIssuesUrl(organization.slug, project.id, version)}
              >
                <Count value={sessionsCrashed} />
              </GlobalSelectionLink>
            </Tooltip>
          ) : (
            <Tooltip title={t('This view is only available with release health data.')}>
              {'\u2014'}
            </Tooltip>
          )}
        </div>
      </div>
    </Container>
  );
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: 50% 50%;
  grid-row-gap: ${space(2)};
  margin-bottom: ${space(3)};
`;

const DateStatWrapper = styled('div')`
  grid-column: 1/3;
`;

export default ReleaseStats;
