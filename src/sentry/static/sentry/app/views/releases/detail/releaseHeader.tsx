import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {URL_PARAM} from 'app/constants/globalSelectionHeader';
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
import * as Layout from 'app/components/layouts/thirds';

import ReleaseStat from './releaseStat';
import ReleaseActions from './releaseActions';

type Props = {
  location: Location;
  orgId: string;
  release: Release;
  project: Required<ReleaseProject>;
  releaseMeta: ReleaseMeta;
  refetchData: () => void;
};

const ReleaseHeader = ({
  location,
  orgId,
  release,
  project,
  releaseMeta,
  refetchData,
}: Props) => {
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
            <ReleaseStat
              label={t('Crashes')}
              help={t('Crash means that user experienced an unhandled error')}
            >
              <Count value={sessionsCrashed} />
            </ReleaseStat>
          )}
          <ReleaseStat label={t('New Issues')}>
            <Count value={newGroups} />
          </ReleaseStat>
          <ReleaseActions orgId={orgId} release={release} refetchData={refetchData} />
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
  color: ${p => p.theme.gray700};
  display: flex;
  align-items: center;
`;

const IconWrapper = styled('span')`
  transition: color 0.3s ease-in-out;
  margin-left: ${space(1)};

  &,
  a {
    color: ${p => p.theme.gray500};
    display: flex;
    &:hover {
      cursor: pointer;
      color: ${p => p.theme.gray700};
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
