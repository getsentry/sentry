import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Count from 'app/components/count';
import Version from 'app/components/version';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import ProjectList from 'app/views/releases/list/projectList';
import ReleaseStats from 'app/components/releaseStats';
import {Project, Release} from 'app/types';
import TimeSince from 'app/components/timeSince';
import {t, tn} from 'app/locale';

import ReleaseHealth from './releaseHealth';

type Props = {
  release: Release;
  projects: Project[];
  orgId: string;
};

const ReleaseCard = ({release, projects, orgId}: Props) => {
  return (
    <Panel>
      <PanelBody>
        <StyledPanelItem>
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
              <ProjectList projects={projects} orgId={orgId} version={release.version} />
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
        </StyledPanelItem>
      </PanelBody>

      {/*  TODO(releasesv2)if has release health data */}
      {Math.random() > 0.6 && <ReleaseHealth release={release} />}
    </Panel>
  );
};

const StyledPanelItem = styled(PanelItem)`
  /* padding: ${space(1)} ${space(2)}; */
`;

const Layout = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 200px 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
`;

const Column = styled('div')`
  overflow: hidden;
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
