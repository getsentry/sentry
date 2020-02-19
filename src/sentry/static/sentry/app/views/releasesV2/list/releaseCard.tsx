import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Count from 'app/components/count';
import Version from 'app/components/version';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import ReleaseStats from 'app/components/releaseStats';
import {Project, AvatarProject, Release} from 'app/types';
import TimeSince from 'app/components/timeSince';
import {t, tn} from 'app/locale';
import {AvatarListWrapper} from 'app/components/avatar/avatarList';
import ProjectList from 'app/components/avatar/projectList';

import ReleaseHealth from './releaseHealth';

type Props = {
  release: Release;
  projects: Project[] | AvatarProject[];
};

const ReleaseCard = ({release, projects}: Props) => {
  return (
    <Panel>
      <PanelBody>
        <PanelItem>
          <Layout>
            <Column>
              <ColumnTitle>{t('Release')}</ColumnTitle>
              <Version
                version={release.version}
                preserveGlobalSelection
                tooltipRawVersion
              />
            </Column>

            <Column>
              <ColumnTitle>
                {tn('%s project', '%s projects', projects.length)}
              </ColumnTitle>
              <ProjectList projects={projects} />
            </Column>

            <Column>
              <ReleaseStats release={release} />
            </Column>

            <RightAlignedColumn>
              <ColumnTitle>{t('Created')}</ColumnTitle>
              {release && (release.dateReleased || release.dateCreated) ? (
                <TimeSince date={release.dateReleased || release.dateCreated} />
              ) : (
                <span>-</span>
              )}
            </RightAlignedColumn>

            <RightAlignedColumn>
              <ColumnTitle>{t('Last event')}</ColumnTitle>
              {release.lastEvent ? (
                <TimeSince date={release.lastEvent} />
              ) : (
                <span>—</span>
              )}
            </RightAlignedColumn>

            <RightAlignedColumn>
              <ColumnTitle>{t('New issues')}</ColumnTitle>
              <Count value={release.newGroups || 0} />
            </RightAlignedColumn>
          </Layout>
        </PanelItem>
      </PanelBody>

      {/*  TODO(releasesv2)if has release health data */}
      {Math.random() > 0.6 && <ReleaseHealth release={release} />}
    </Panel>
  );
};

const Layout = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 200px 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
`;

const Column = styled('div')`
  overflow: hidden;
  ${AvatarListWrapper} {
    padding-left: ${space(0.75)};
  }
`;

const RightAlignedColumn = styled('div')`
  overflow: hidden;
  text-align: right;
`;

const ColumnTitle = styled('div')`
  text-transform: uppercase;
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  margin-bottom: ${space(0.75)};
  line-height: 1.2;
`;

export default ReleaseCard;
