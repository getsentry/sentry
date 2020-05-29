import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import space from 'app/styles/space';
import Count from 'app/components/count';
import Version from 'app/components/version';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import ReleaseStats from 'app/components/releaseStats';
import {Release, GlobalSelection} from 'app/types';
import TimeSince from 'app/components/timeSince';
import {t, tn} from 'app/locale';
import {AvatarListWrapper} from 'app/components/avatar/avatarList';
import TextOverflow from 'app/components/textOverflow';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import DeployBadge from 'app/components/deployBadge';
import Link from 'app/components/links/link';
import Feature from 'app/components/acl/feature';
import Tooltip from 'app/components/tooltip';

import ReleaseHealth from './releaseHealth';
import NotAvailable from './notAvailable';
import {getReleaseNewIssuesUrl} from '../utils';

type Props = {
  release: Release;
  orgSlug: string;
  location: Location;
  selection: GlobalSelection;
  reloading: boolean;
  showHealthPlaceholders: boolean;
};

const ReleaseCard = ({
  release,
  orgSlug,
  location,
  reloading,
  selection,
  showHealthPlaceholders,
}: Props) => {
  const {version, commitCount, lastDeploy, authors, dateCreated} = release;

  return (
    <StyledPanel reloading={reloading ? 1 : 0}>
      <PanelBody>
        <StyledPanelItem>
          <HeaderLayout>
            <VersionColumn>
              <ColumnTitle>{t('Release Version')}</ColumnTitle>
            </VersionColumn>

            <CreatedColumn>
              <ColumnTitle>
                {lastDeploy?.dateFinished ? t('Last Deploy') : t('Date Created')}
              </ColumnTitle>
            </CreatedColumn>

            <CommitsColumn>
              <ColumnTitle>
                {commitCount > 0
                  ? [
                      tn('%s commit', '%s commits', commitCount || 0),
                      t('by'),
                      tn('%s author', '%s authors', authors.length || 0),
                    ].join(' ')
                  : t('Commits')}
              </ColumnTitle>
            </CommitsColumn>

            <NewIssuesColumn>
              <ColumnTitle>{t('New issues')}</ColumnTitle>
            </NewIssuesColumn>
          </HeaderLayout>

          <Layout>
            <VersionColumn>
              <VersionWrapper>
                <Version version={version} tooltipRawVersion truncate anchor={false} />
              </VersionWrapper>
            </VersionColumn>

            <CreatedColumn>
              <TextOverflow>
                {lastDeploy?.dateFinished && <StyledDeployBadge deploy={lastDeploy} />}
                <TimeSince date={lastDeploy?.dateFinished || dateCreated} />
              </TextOverflow>
            </CreatedColumn>

            <CommitsColumn>
              <CommitsWrapper>
                {commitCount > 0 ? (
                  <ReleaseStats release={release} withHeading={false} />
                ) : (
                  <NotAvailable />
                )}
              </CommitsWrapper>
            </CommitsColumn>

            <NewIssuesColumn>
              <Feature features={['global-views']}>
                {({hasFeature}) =>
                  hasFeature ? (
                    <Tooltip title={t('Open in Issues')}>
                      <Link to={getReleaseNewIssuesUrl(orgSlug, null, version)}>
                        <Count value={release.newGroups || 0} />
                      </Link>
                    </Tooltip>
                  ) : (
                    <Count value={release.newGroups || 0} />
                  )
                }
              </Feature>
            </NewIssuesColumn>
          </Layout>
        </StyledPanelItem>
      </PanelBody>

      <ReleaseHealth
        release={release}
        orgSlug={orgSlug}
        location={location}
        showPlaceholders={showHealthPlaceholders}
        selection={selection}
      />
    </StyledPanel>
  );
};

const StyledPanel = styled(Panel)<{reloading: number}>`
  opacity: ${p => (p.reloading ? 0.5 : 1)};
  pointer-events: ${p => (p.reloading ? 'none' : 'auto')};
  overflow: hidden;
`;

const StyledPanelItem = styled(PanelItem)`
  flex-direction: column;
`;

const Layout = styled('div')`
  display: grid;
  /* 0fr a,b,c are here to match the health grid layout (offset because of gap on fewer columns) */
  grid-template-areas: 'version created a b commits c new-issues';
  grid-template-columns: 2fr 4.8fr 0fr 0fr 2.1fr 0fr 1.5fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-areas: 'version created a commits b new-issues';
    grid-template-columns: 2fr 3.5fr 0fr 2.5fr 0fr 1fr;
  }
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-areas: 'version created a b new-issues';
    grid-template-columns: 2fr 3fr 0fr 0fr 2fr;
  }
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-areas: 'version created new-issues';
    grid-template-columns: 2fr 1.5fr 1fr;
  }
`;

const HeaderLayout = styled(Layout)`
  align-items: flex-end;
`;

const Column = styled('div')`
  overflow: hidden;
  ${AvatarListWrapper} {
    padding-left: ${space(0.75)};
  }
`;

const RightAlignedColumn = styled(Column)`
  text-align: right;
`;

const VersionColumn = styled(Column)`
  grid-area: version;
  display: flex;
  align-items: center;
`;

const CommitsColumn = styled(Column)`
  grid-area: commits;
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    display: none;
  }
`;

const CreatedColumn = styled(Column)`
  grid-area: created;
`;

const NewIssuesColumn = styled(RightAlignedColumn)`
  grid-area: new-issues;
`;

const ColumnTitle = styled('div')`
  text-transform: uppercase;
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  margin-bottom: ${space(0.75)};
  line-height: 1.2;
`;

const VersionWrapper = styled('div')`
  ${overflowEllipsis};
  max-width: 100%;
  width: auto;
  display: inline-block;
`;

const StyledDeployBadge = styled(DeployBadge)`
  position: relative;
  bottom: ${space(0.25)};
  margin-right: ${space(1)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const CommitsWrapper = styled('div')`
  position: relative;
  bottom: ${space(0.25)};
`;

export default ReleaseCard;
