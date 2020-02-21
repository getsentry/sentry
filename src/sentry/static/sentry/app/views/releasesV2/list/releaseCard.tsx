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
  // TODO(releasesv2): probably makes sense at this point to split the header and data to different files (move styles to share layout file)
  return (
    <Panel>
      <PanelBody>
        <StyledPanelItem>
          <HeaderLayout>
            <VersionColumn>
              <ColumnTitle>{t('Release')}</ColumnTitle>
            </VersionColumn>
            <ProjectsColumn>
              <ColumnTitle>
                {tn('%s project', '%s projects', projects.length)}
              </ColumnTitle>
            </ProjectsColumn>
            <CommitsColumn>
              {release.commitCount > 0 && (
                <ColumnTitle>
                  {[
                    tn('%s commit', '%s commits', release.commitCount || 0),
                    t('by'),
                    tn('%s author', '%s authors', release.authors?.length || 0),
                  ].join(' ')}
                </ColumnTitle>
              )}
            </CommitsColumn>
            <CreatedColumn>
              <ColumnTitle>{t('Created')}</ColumnTitle>
            </CreatedColumn>
            <LastEventColumn>
              <ColumnTitle>{t('Last event')}</ColumnTitle>
            </LastEventColumn>
            <NewIssuesColumn>
              <ColumnTitle>{t('New issues')}</ColumnTitle>
            </NewIssuesColumn>
          </HeaderLayout>
          <Layout>
            <VersionColumn>
              <Version
                version={release.version}
                preserveGlobalSelection
                tooltipRawVersion
                truncate
              />
              <TimeWithIcon date={release.dateReleased || release.dateCreated} />
            </VersionColumn>

            <ProjectsColumn>
              <ProjectList projects={projects} />
            </ProjectsColumn>

            <CommitsColumn>
              <ReleaseStats release={release} withHeading={false} />
            </CommitsColumn>

            <CreatedColumn>
              {release.dateReleased || release.dateCreated ? (
                <TimeSince date={release.dateReleased || release.dateCreated} />
              ) : (
                <span>-</span>
              )}
            </CreatedColumn>

            <LastEventColumn>
              {release.lastEvent ? (
                <TimeSince date={release.lastEvent} />
              ) : (
                <span>—</span>
              )}
            </LastEventColumn>

            <NewIssuesColumn>
              <Count value={release.newGroups || 0} />
            </NewIssuesColumn>
          </Layout>
        </StyledPanelItem>
      </PanelBody>

      {/*  TODO(releasesv2)if has release health data */}
      {Math.random() > 0.6 && <ReleaseHealth release={release} />}
    </Panel>
  );
};

const StyledPanelItem = styled(PanelItem)`
  flex-direction: column;
`;

const Layout = styled('div')`
  display: grid;
  grid-template-areas: 'version projects commits created last-event new-issues';
  grid-template-columns: 1fr 1fr 1fr 200px 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-areas: 'version projects created last-event new-issues';
    grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
  }
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-areas: 'version projects new-issues';
    grid-template-columns: 2fr 1fr 1fr;
  }
`;

const HeaderLayout = styled(Layout)`
  align-items: flex-start;
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

const VersionColumn = styled(Column)`
  grid-area: version;
`;

const ProjectsColumn = styled(Column)`
  grid-area: projects;
`;

const CommitsColumn = styled(Column)`
  grid-area: commits;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    display: none;
  }
`;

const CreatedColumn = styled(RightAlignedColumn)`
  grid-area: created;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const LastEventColumn = styled(RightAlignedColumn)`
  grid-area: last-event;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const NewIssuesColumn = styled(RightAlignedColumn)`
  grid-area: new-issues;
`;

const ColumnTitle = styled('div')`
  text-transform: uppercase;
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  margin-bottom: ${space(0.75)};
  line-height: 1.2;
`;

const TimeWithIcon = styled(({date, ...props}) => (
  <span {...props}>
    <ClockIcon className="icon icon-clock" />
    <TimeSince date={date} />
  </span>
))`
  align-items: center;
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeSmall};
  display: none;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: inline-flex;
  }
`;
const ClockIcon = styled('span')`
  margin-right: ${space(0.25)};
`;

export default ReleaseCard;
