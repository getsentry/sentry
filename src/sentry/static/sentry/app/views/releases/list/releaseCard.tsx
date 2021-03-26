import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import {Panel} from 'app/components/panels';
import ReleaseStats from 'app/components/releaseStats';
import TextOverflow from 'app/components/textOverflow';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {GlobalSelection, Organization, Release} from 'app/types';

import {ReleaseHealthRequestRenderProps} from '../utils/releaseHealthRequest';

import ReleaseHealth from './releaseHealth';
import {DisplayOption} from './utils';

function getReleaseProjectId(release: Release, selection: GlobalSelection) {
  // if a release has only one project
  if (release.projects.length === 1) {
    return release.projects[0].id;
  }

  // if only one project is selected in global header and release has it (second condition will prevent false positives like -1)
  if (
    selection.projects.length === 1 &&
    release.projects.map(p => p.id).includes(selection.projects[0])
  ) {
    return selection.projects[0];
  }

  // project selector on release detail page will pick it up
  return undefined;
}

type Props = {
  release: Release;
  organization: Organization;
  activeDisplay: DisplayOption;
  location: Location;
  selection: GlobalSelection;
  reloading: boolean;
  showHealthPlaceholders: boolean;
  isTopRelease: boolean;
  getHealthData: ReleaseHealthRequestRenderProps['getHealthData'];
};

const ReleaseCard = ({
  release,
  organization,
  activeDisplay,
  location,
  reloading,
  selection,
  showHealthPlaceholders,
  isTopRelease,
  getHealthData,
}: Props) => {
  const {version, commitCount, lastDeploy, dateCreated, versionInfo} = release;

  return (
    <StyledPanel reloading={reloading ? 1 : 0}>
      <ReleaseInfo>
        <ReleaseInfoHeader>
          <GlobalSelectionLink
            to={{
              pathname: `/organizations/${
                organization.slug
              }/releases/${encodeURIComponent(version)}/`,
              query: {project: getReleaseProjectId(release, selection)},
            }}
          >
            <GuideAnchor disabled={!isTopRelease} target="release_version">
              <VersionWrapper>
                <StyledVersion version={version} tooltipRawVersion anchor={false} />
              </VersionWrapper>
            </GuideAnchor>
          </GlobalSelectionLink>
          {commitCount > 0 && <ReleaseStats release={release} withHeading={false} />}
        </ReleaseInfoHeader>
        <ReleaseInfoSubheader>
          {versionInfo?.package && (
            <PackageName ellipsisDirection="left">{versionInfo.package}</PackageName>
          )}
          <TimeSince date={lastDeploy?.dateFinished || dateCreated} />
          {lastDeploy?.dateFinished && ` \u007C ${lastDeploy.environment}`}
        </ReleaseInfoSubheader>
      </ReleaseInfo>

      <ReleaseProjects>
        <ReleaseHealth
          release={release}
          organization={organization}
          activeDisplay={activeDisplay}
          location={location}
          showPlaceholders={showHealthPlaceholders}
          reloading={reloading}
          selection={selection}
          isTopRelease={isTopRelease}
          getHealthData={getHealthData}
        />
      </ReleaseProjects>
    </StyledPanel>
  );
};

const VersionWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledVersion = styled(Version)`
  ${overflowEllipsis};
`;

const StyledPanel = styled(Panel)<{reloading: number}>`
  opacity: ${p => (p.reloading ? 0.5 : 1)};
  pointer-events: ${p => (p.reloading ? 'none' : 'auto')};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: flex;
  }
`;

const ReleaseInfo = styled('div')`
  padding: ${space(1.5)} ${space(2)};
  flex-shrink: 0;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    border-right: 1px solid ${p => p.theme.border};
    min-width: 260px;
    width: 22%;
    max-width: 300px;
  }
`;

const ReleaseInfoSubheader = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray400};
`;

const PackageName = styled(TextOverflow)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.textColor};
`;

const ReleaseProjects = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  flex-grow: 1;
  display: grid;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    border-top: none;
  }
`;

const ReleaseInfoHeader = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  grid-gap: ${space(2)};
  align-items: center;
`;

export default ReleaseCard;
