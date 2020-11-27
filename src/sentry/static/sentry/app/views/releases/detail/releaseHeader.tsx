import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import pick from 'lodash/pick';

import Feature from 'app/components/acl/feature';
import Badge from 'app/components/badge';
import Breadcrumbs from 'app/components/breadcrumbs';
import Clipboard from 'app/components/clipboard';
import Count from 'app/components/count';
import DeployBadge from 'app/components/deployBadge';
import * as Layout from 'app/components/layouts/thirds';
import ExternalLink from 'app/components/links/externalLink';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import Version from 'app/components/version';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {IconCopy, IconOpen} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Release, ReleaseMeta, ReleaseProject} from 'app/types';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {formatAbbreviatedNumber, formatVersion} from 'app/utils/formatters';
import {getTermHelp} from 'app/views/performance/data';

import {getSessionTermDescription, SessionTerm, sessionTerm} from '../utils/sessionTerm';

import ReleaseActions from './releaseActions';
import ReleaseStat from './releaseStat';

type Props = {
  location: Location;
  organization: Organization;
  releaseEventView: EventView;
  release: Release;
  project: Required<ReleaseProject>;
  releaseMeta: ReleaseMeta;
  refetchData: () => void;
};

const ReleaseHeader = ({
  location,
  organization,
  releaseEventView,
  release,
  project,
  releaseMeta,
  refetchData,
}: Props) => {
  const {version, newGroups, url, lastDeploy, dateCreated} = release;
  const {commitCount, commitFilesChanged, releaseFileCount} = releaseMeta;
  const {hasHealthData} = project;
  const {sessionsCrashed} = project.healthData;

  const releasePath = `/organizations/${organization.slug}/releases/${encodeURIComponent(
    version
  )}/`;

  const tabs = [
    {title: t('Overview'), to: releasePath},
    {
      title: (
        <React.Fragment>
          {t('Commits')} <NavTabsBadge text={formatAbbreviatedNumber(commitCount)} />
        </React.Fragment>
      ),
      to: `${releasePath}commits/`,
    },
    {
      title: (
        <React.Fragment>
          {t('Files Changed')}
          <NavTabsBadge text={formatAbbreviatedNumber(commitFilesChanged)} />
        </React.Fragment>
      ),
      to: `${releasePath}files-changed/`,
    },
    {
      title: (
        <React.Fragment>
          {t('Artifacts')}
          <NavTabsBadge text={formatAbbreviatedNumber(releaseFileCount)} />
        </React.Fragment>
      ),
      to: `${releasePath}artifacts/`,
    },
  ];

  const getCurrentTabUrl = (path: string) => ({
    pathname: path,
    query: pick(location.query, Object.values(URL_PARAM)),
  });

  return (
    <StyledHeader>
      <HeaderInfoContainer>
        <Breadcrumbs
          crumbs={[
            {
              to: `/organizations/${organization.slug}/releases/`,
              label: t('Releases'),
              preserveGlobalSelection: true,
            },
            {label: formatVersion(version)},
          ]}
        />

        <StatsWrapper>
          <ReleaseStat
            label={lastDeploy?.dateFinished ? t('Last Deploy') : t('Date Created')}
          >
            <DeploysWrapper>
              <TimeSince date={lastDeploy?.dateFinished || dateCreated} />
              {lastDeploy?.dateFinished && <StyledDeployBadge deploy={lastDeploy} />}
            </DeploysWrapper>
          </ReleaseStat>
          {hasHealthData && (
            <ReleaseStat
              label={sessionTerm.crashes}
              help={getSessionTermDescription(SessionTerm.CRASHES, project.platform)}
            >
              <Count value={sessionsCrashed} />
            </ReleaseStat>
          )}
          <Feature features={['release-performance-views']}>
            <ReleaseStat label={t('Apdex')} help={getTermHelp(organization, 'apdex')}>
              <DiscoverQuery
                eventView={releaseEventView}
                location={location}
                orgSlug={organization.slug}
              >
                {({isLoading, error, tableData}) => {
                  if (isLoading || error || !tableData || tableData.data.length === 0) {
                    return '\u2014';
                  }
                  return (
                    <Count
                      value={
                        tableData.data[0][
                          getAggregateAlias(`apdex(${organization.apdexThreshold})`)
                        ]
                      }
                    />
                  );
                }}
              </DiscoverQuery>
            </ReleaseStat>
          </Feature>
          <ReleaseStat label={t('New Issues')}>
            <Count value={newGroups} />
          </ReleaseStat>
          <ReleaseActions
            orgSlug={organization.slug}
            projectSlug={project.slug}
            release={release}
            releaseMeta={releaseMeta}
            refetchData={refetchData}
          />
        </StatsWrapper>
      </HeaderInfoContainer>

      <Layout.HeaderContent>
        <ReleaseName>
          <Version version={version} anchor={false} />

          <IconWrapper>
            <Clipboard value={version}>
              <Tooltip title={version} containerDisplayMode="flex">
                <IconCopy size="xs" />
              </Tooltip>
            </Clipboard>
          </IconWrapper>

          {!!url && (
            <IconWrapper>
              <Tooltip title={url}>
                <ExternalLink href={url}>
                  <IconOpen size="xs" />
                </ExternalLink>
              </Tooltip>
            </IconWrapper>
          )}
        </ReleaseName>
      </Layout.HeaderContent>

      <StyledNavTabs>
        {tabs.map(tab => (
          <ListLink
            key={tab.to}
            to={getCurrentTabUrl(tab.to)}
            isActive={() => tab.to === location.pathname}
          >
            {tab.title}
          </ListLink>
        ))}
      </StyledNavTabs>
    </StyledHeader>
  );
};

const StyledHeader = styled(Layout.Header)`
  flex-direction: column;
`;

const HeaderInfoContainer = styled('div')`
  margin-bottom: ${space(1)};
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: grid;
    grid-column-gap: ${space(3)};
    grid-template-columns: 1fr 1fr;
    margin-bottom: 0;
    align-items: flex-start;
  }
`;

const StatsWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: grid;
    padding: ${space(1.5)} 0;
    grid-auto-flow: column;
    grid-gap: ${space(4)};
  }
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    justify-content: flex-end;
    text-align: right;
  }
`;

const DeploysWrapper = styled('div')`
  white-space: nowrap;
`;

const StyledDeployBadge = styled(DeployBadge)`
  margin-left: ${space(1)};
  bottom: ${space(0.25)};
`;

const ReleaseName = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.textColor};
  display: flex;
  align-items: center;
`;

const IconWrapper = styled('span')`
  transition: color 0.3s ease-in-out;
  margin-left: ${space(1)};

  &,
  a {
    color: ${p => p.theme.gray300};
    display: flex;
    &:hover {
      cursor: pointer;
      color: ${p => p.theme.textColor};
    }
  }
`;

const StyledNavTabs = styled(NavTabs)`
  margin-bottom: 0;
  grid-column: 1 / 2;
`;

const NavTabsBadge = styled(Badge)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

export default ReleaseHeader;
