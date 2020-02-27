import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Count from 'app/components/count';
import Version from 'app/components/version';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import ReleaseStats from 'app/components/releaseStats';
import {Project, AvatarProject, ProjectRelease} from 'app/types';
import TimeSince from 'app/components/timeSince';
import {t, tn} from 'app/locale';
import {AvatarListWrapper} from 'app/components/avatar/avatarList';
import ProjectBadge from 'app/components/idBadge/projectBadge.jsx';
import overflowEllipsis from 'app/styles/overflowEllipsis';

import ReleaseHealth from './releaseHealth';

type Props = {
  release: ProjectRelease;
  project?: Project | AvatarProject;
};

const ReleaseCard = ({release, project}: Props) => {
  // TODO(releasesv2): probably makes sense at this point to split the header and data to different files (move styles to share layout file)
  return (
    <Panel>
      <PanelBody>
        <StyledPanelItem>
          <HeaderLayout>
            <VersionColumn>
              <ColumnTitle>{t('Version')}</ColumnTitle>
            </VersionColumn>
            <ProjectsColumn>
              <ColumnTitle>{t('Project name')}</ColumnTitle>
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
            <NewIssuesColumn>
              <ColumnTitle>{t('New issues')}</ColumnTitle>
            </NewIssuesColumn>
          </HeaderLayout>
          <Layout>
            <VersionColumn>
              <VersionWrapper>
                <Version
                  version={release.version}
                  preserveGlobalSelection
                  tooltipRawVersion
                  truncate
                />
                <TimeWithIcon date={release.dateReleased || release.dateCreated} />
              </VersionWrapper>
            </VersionColumn>

            <ProjectsColumn>
              <ProjectBadge project={project} avatarSize={14} key={project?.slug} />
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

            <NewIssuesColumn>
              <Count value={release.newGroups || 0} />
            </NewIssuesColumn>
          </Layout>
        </StyledPanelItem>
      </PanelBody>

      {release.healthData && <ReleaseHealth release={release} />}
    </Panel>
  );
};

const StyledPanelItem = styled(PanelItem)`
  flex-direction: column;
`;

const Layout = styled('div')`
  display: grid;
  grid-template-areas: 'version projects commits created new-issues';
  grid-template-columns: 3fr minmax(230px, 2fr) 4fr 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-areas: 'version projects created new-issues';
    grid-template-columns: 2fr 1fr 1fr 1fr;
  }
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-areas: 'version projects new-issues';
    grid-template-columns: 2fr 2fr 1fr;
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

const CenterColumn = styled(Column)`
  text-align: center;
`;

const VersionColumn = styled(Column)`
  grid-area: version;
  display: flex;
  align-items: center;
`;

const ProjectsColumn = styled(Column)`
  grid-area: projects;
`;

const CommitsColumn = styled(CenterColumn)`
  grid-area: commits;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    display: none;
  }
`;

const CreatedColumn = styled(RightAlignedColumn)`
  grid-area: created;
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
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

const VersionWrapper = styled('div')`
  ${overflowEllipsis};
  max-width: 100%;
  width: auto;
  display: inline-block;
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
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    display: inline-flex;
  }
`;
const ClockIcon = styled('span')`
  margin-right: ${space(0.25)};
`;

export default ReleaseCard;
