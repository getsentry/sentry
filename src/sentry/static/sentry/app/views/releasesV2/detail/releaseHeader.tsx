import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t} from 'app/locale';
import Link from 'app/components/links/link';
import ListLink from 'app/components/links/listLink';
import ExternalLink from 'app/components/links/externalLink';
import NavTabs from 'app/components/navTabs';
import {Release, Deploy, ReleaseProject} from 'app/types';
import Version from 'app/components/version';
import Clipboard from 'app/components/clipboard';
import {IconCopy, IconOpen} from 'app/icons';
import Tooltip from 'app/components/tooltip';
import Badge from 'app/components/badge';
import Count from 'app/components/count';
import TimeSince from 'app/components/timeSince';
import {formatVersion} from 'app/utils/formatters';
import Breadcrumbs from 'app/components/breadcrumbs';

import ReleaseStat from './releaseStat';
import ReleaseActions from './releaseActions';

type Props = {
  location: Location;
  orgId: string;
  release: Release;
  deploys: Deploy[];
  project: ReleaseProject;
};

const ReleaseHeader = ({location, orgId, release, deploys, project}: Props) => {
  const {version, newGroups, url} = release;
  const {healthData} = project;

  const releasePath = `/organizations/${orgId}/releases-v2/${encodeURIComponent(
    version
  )}/`;

  const tabs = [
    {title: t('Overview'), to: releasePath},
    {title: t('Commits'), to: `${releasePath}commits/`},
    {title: t('Files Changed'), to: `${releasePath}files-changed/`},
    {title: t('Artifacts'), to: `${releasePath}artifacts/`},
  ];

  return (
    <Header>
      <Layout>
        <Breadcrumbs
          crumbs={[
            {
              to: `/organizations/${orgId}/releases-v2/`,
              label: t('Releases'),
            },
            {label: formatVersion(version)},
          ]}
        />

        <StatsWrapper>
          {deploys.length > 0 && (
            <ReleaseStat label={t('Deploys')}>
              <DeploysWrapper>
                {deploys.map(deploy => (
                  <Tooltip
                    title={<TimeSince date={deploy.dateFinished} />}
                    key={deploy.id}
                  >
                    <Link
                      title={t('View in stream')}
                      to={`/organizations/${orgId}/issues/?query=release:${encodeURIComponent(
                        version
                      )}&environment=${encodeURIComponent(deploy.environment)}`}
                    >
                      <StyledBadge text={deploy.environment} />
                    </Link>
                  </Tooltip>
                ))}
              </DeploysWrapper>
            </ReleaseStat>
          )}
          {healthData?.hasHealthData && (
            <ReleaseStat label={t('Crashes')}>
              <Count value={healthData?.sessionsCrashed ?? 0} />
            </ReleaseStat>
          )}
          <ReleaseStat label={t('New Issues')}>
            <Count value={newGroups} />
          </ReleaseStat>
          <ReleaseActions version={version} orgId={orgId} />
        </StatsWrapper>
      </Layout>

      <ReleaseName>
        <Version version={version} anchor={false} />

        <IconWrapper>
          <Clipboard value={version}>
            <Tooltip title={version}>
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
  display: flex;
  margin-top: ${space(0.5)};
`;

const StyledBadge = styled(Badge)`
  background-color: ${p => p.theme.gray4};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 400;
`;

const ReleaseName = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.gray4};
  margin-bottom: ${space(2)};
`;

const IconWrapper = styled('span')`
  transition: color 0.3s ease-in-out;
  margin-left: ${space(1)};

  &,
  a {
    color: ${p => p.theme.gray2};
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

export default ReleaseHeader;
