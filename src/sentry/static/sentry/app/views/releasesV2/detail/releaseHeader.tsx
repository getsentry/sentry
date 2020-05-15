import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t} from 'app/locale';
import ListLink from 'app/components/links/listLink';
import ExternalLink from 'app/components/links/externalLink';
import NavTabs from 'app/components/navTabs';
import {Release, ReleaseProject, ReleaseMeta} from 'app/types';
import Version from 'app/components/version';
import Clipboard from 'app/components/clipboard';
import {IconCopy, IconOpen} from 'app/icons';
import Tooltip from 'app/components/tooltip';
import Count from 'app/components/count';
import TimeSince from 'app/components/timeSince';
import {formatVersion, formatAbbreviatedNumber} from 'app/utils/formatters';
import Breadcrumbs from 'app/components/breadcrumbs';
import DeployBadge from 'app/components/deployBadge';
import Badge from 'app/components/badge';

import ReleaseStat from './releaseStat';
import ReleaseActions from './releaseActions';

type Props = {
  location: Location;
  orgId: string;
  release: Release;
  project: ReleaseProject;
  releaseMeta: ReleaseMeta;
};

const ReleaseHeader = ({location, orgId, release, project, releaseMeta}: Props) => {
  const {version, newGroups, url, lastDeploy, dateCreated} = release;
  const {commitCount, commitFilesChanged, releaseFileCount} = releaseMeta;
  const {hasHealthData, sessionsCrashed} = project.healthData;

  const releasePath = `/organizations/${orgId}/releases/${encodeURIComponent(version)}/`;

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

  return (
    <Header>
      <Layout>
        <Breadcrumbs
          crumbs={[
            {
              to: `/organizations/${orgId}/releases/`,
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
            <ReleaseStat label={t('Crashes')}>
              <Count value={sessionsCrashed} />
            </ReleaseStat>
          )}
          <ReleaseStat label={t('New Issues')}>
            <Count value={newGroups} />
          </ReleaseStat>
          <ReleaseActions version={version} orgId={orgId} hasHealthData={hasHealthData} />
        </StatsWrapper>
      </Layout>

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

      <StyledNavTabs>
        {tabs.map(tab => (
          <ListLink
            key={tab.to}
            to={`${tab.to}${location.search}`}
            isActive={() => tab.to === location.pathname}
          >
            {tab.title}
          </ListLink>
        ))}
      </StyledNavTabs>
    </Header>
  );
};

const Header = styled('div')`
  padding: ${space(2)} ${space(4)} 0;
  border-bottom: 1px solid ${p => p.theme.borderDark};
`;

const Layout = styled('div')`
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
  color: ${p => p.theme.gray4};
  margin-bottom: ${space(2)};
  display: flex;
  align-items: center;
`;

const IconWrapper = styled('span')`
  transition: color 0.3s ease-in-out;
  margin-left: ${space(1)};

  &,
  a {
    color: ${p => p.theme.gray2};
    display: flex;
    &:hover {
      cursor: pointer;
      color: ${p => p.theme.gray4};
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
