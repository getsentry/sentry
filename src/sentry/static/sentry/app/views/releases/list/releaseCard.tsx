import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Panel} from 'app/components/panels';
import ReleaseStats from 'app/components/releaseStats';
import TextOverflow from 'app/components/textOverflow';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {GlobalSelection, Release} from 'app/types';

import ReleaseHealth from './releaseHealth';
import {DisplayOption} from './utils';

type Props = {
  release: Release;
  orgSlug: string;
  activeDisplay: DisplayOption;
  location: Location;
  selection: GlobalSelection;
  reloading: boolean;
  showHealthPlaceholders: boolean;
};

const ReleaseCard = ({
  release,
  orgSlug,
  activeDisplay,
  location,
  reloading,
  selection,
  showHealthPlaceholders,
}: Props) => {
  const {version, commitCount, lastDeploy, dateCreated, versionInfo} = release;

  return (
    <StyledPanel reloading={reloading ? 1 : 0}>
      <ReleaseInfo>
        <ReleaseInfoHeader>
          <VersionWrapper>
            <StyledVersion version={version} tooltipRawVersion anchor={false} />
          </VersionWrapper>
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
          orgSlug={orgSlug}
          activeDisplay={activeDisplay}
          location={location}
          showPlaceholders={showHealthPlaceholders}
          reloading={reloading}
          selection={selection}
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
  color: ${p => p.theme.gray500};
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
