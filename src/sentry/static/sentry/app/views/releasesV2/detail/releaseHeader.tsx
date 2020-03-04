import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t} from 'app/locale';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import {Release} from 'app/types';
import Version from 'app/components/version';
import Clipboard from 'app/components/clipboard';
import {IconCopy, IconDelete} from 'app/icons';
import Tooltip from 'app/components/tooltip';
import Button from 'app/components/button';
import Badge from 'app/components/badge';

import ReleaseStat from './releaseStat';
import Breadcrumbs from './breadcrumbs';

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
    <HeaderBox>
      <Breadcrumbs
        crumbs={[
          {
            label: t('Releases'),
            to: `/organizations/${orgId}/releases-v2/`,
          },
          {label: <Version version={version} anchor={false} />},
        ]}
      />

      <ReleaseControls>
        <ReleaseStat label={t('Deploys')}>
          <DeploysWrapper>
            <StyledBadge text="stag" />
            <StyledBadge text="prod" />
          </DeploysWrapper>
        </ReleaseStat>
        <ReleaseStat label={t('Crashes')}>{(1234).toLocaleString()}</ReleaseStat>
        <ReleaseStat label={t('Errors')}>{(4321).toLocaleString()}</ReleaseStat>
        <div>
          <Button>
            <IconDelete size="xs" />
          </Button>
        </div>
      </ReleaseControls>

      <ReleaseName>
        <Version version={version} anchor={false} />
        <Clipboard value={version}>
          <ClipboardIconWrapper>
            <Tooltip title={version}>
              <IconCopy size="xs" />
            </Tooltip>
          </ClipboardIconWrapper>
        </Clipboard>
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
    </HeaderBox>
  );
};

const HeaderBox = styled('div')`
  padding: ${space(2)} ${space(4)} 0;
  border-bottom: 1px solid ${p => p.theme.borderDark};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: grid;
    grid-column-gap: ${space(3)};
    grid-template-columns: 66% auto;
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: auto 325px;
  }
`;

const ReleaseControls = styled('div')`
  display: grid;
  grid-column-gap: ${space(4)};
  grid-auto-flow: column;
  justify-content: flex-start;
  padding: ${space(1.5)} 0;
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

const ClipboardIconWrapper = styled('span')`
  color: ${p => p.theme.gray2};
  transition: color 0.3s ease-in-out;
  margin-left: ${space(1)};
  &:hover {
    cursor: pointer;
    color: ${p => p.theme.gray4};
  }
`;

const StyledNavTabs = styled(NavTabs)`
  margin-bottom: 0;
  grid-column: 1 / 2;
`;

export default ReleaseHeader;
