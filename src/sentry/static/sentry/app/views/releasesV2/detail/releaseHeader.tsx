import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t} from 'app/locale';
import ListLink from 'app/components/links/listLink';
import ExternalLink from 'app/components/links/externalLink';
import NavTabs from 'app/components/navTabs';
import {Release} from 'app/types';
import Version from 'app/components/version';
import Clipboard from 'app/components/clipboard';
import {IconCopy, IconOpen} from 'app/icons';
import Tooltip from 'app/components/tooltip';
import Badge from 'app/components/badge';

import ReleaseStat from './releaseStat';
import Breadcrumbs from './breadcrumbs';
import ReleaseActions from './releaseActions';

type Props = {
  location: Location;
  orgId: string;
  release: Release;
};

const ReleaseHeader = ({location, orgId, release}: Props) => {
  const {version} = release;

  const releasePath = `/organizations/${orgId}/releases-v2/${encodeURIComponent(
    version
  )}/`;

  const links = [
    {title: t('Overview'), to: releasePath},
    {title: t('Commits'), to: `${releasePath}commits/`},
    {title: t('Artifacts'), to: `${releasePath}artifacts/`},
    {title: t('Files Changed'), to: `${releasePath}files-changed/`},
  ];

  return (
    <Header>
      <Layout>
        <Breadcrumbs
          crumbs={[
            {
              label: t('Releases'),
              to: `/organizations/${orgId}/releases-v2/`,
            },
            {label: <Version version={version} anchor={false} />},
          ]}
        />

        <StatsWrapper>
          <ReleaseStat label={t('Deploys')}>
            <DeploysWrapper>
              <StyledBadge text="stag" />
              <StyledBadge text="prod" />
            </DeploysWrapper>
          </ReleaseStat>
          <ReleaseStat label={t('Crashes')}>{(1234).toLocaleString()}</ReleaseStat>
          <ReleaseStat label={t('Errors')}>{(4321).toLocaleString()}</ReleaseStat>
          <ReleaseActions version={release.version} orgId={orgId} />
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

        <IconWrapper>
          <Tooltip title="https://freight.getsentry.net/deploys/getsentry/production/8261/">
            <ExternalLink href="https://freight.getsentry.net/deploys/getsentry/production/8261/">
              <IconOpen size="xs" />
            </ExternalLink>
          </Tooltip>
        </IconWrapper>
      </ReleaseName>

      <StyledNavTabs>
        {links.map(link => (
          <ListLink
            key={link.to}
            to={`${link.to}${location.search}`}
            isActive={() => link.to === location.pathname}
          >
            {link.title}
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
  }
`;

const StatsWrapper = styled('div')`
  display: grid;
  grid-auto-flow: row;
  grid-gap: ${space(2)};
  padding: ${space(1.5)} 0;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
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
