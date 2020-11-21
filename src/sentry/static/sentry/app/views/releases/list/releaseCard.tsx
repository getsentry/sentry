import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import DeployBadge from 'app/components/deployBadge';
import {Panel} from 'app/components/panels';
import ReleaseStats from 'app/components/releaseStats';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import space from 'app/styles/space';
import {GlobalSelection, Release} from 'app/types';

import NotAvailable from './notAvailable';
import ReleaseHealth from './releaseHealth';

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
  const {version, commitCount, lastDeploy, dateCreated} = release;

  return (
    <StyledReleaseCard reloading={reloading ? 1 : 0}>
      <ReleaseInfo>
        <ReleaseInfoHeader>
          <Version version={version} tooltipRawVersion truncate anchor={false} />
          {commitCount > 0 ? (
            <ReleaseStats release={release} withHeading={false} />
          ) : (
            <NotAvailable />
          )}
        </ReleaseInfoHeader>
        <ReleaseInfoSubheader>
          {lastDeploy?.dateFinished && <StyledDeployBadge deploy={lastDeploy} />}
          <TimeSince date={lastDeploy?.dateFinished || dateCreated} />
        </ReleaseInfoSubheader>
      </ReleaseInfo>

      <ReleaseProjects>
        <ReleaseHealth
          release={release}
          orgSlug={orgSlug}
          location={location}
          showPlaceholders={showHealthPlaceholders}
          selection={selection}
        />
      </ReleaseProjects>
    </StyledReleaseCard>
  );
};

const StyledReleaseCard = styled(Panel)<{reloading: number}>`
  opacity: ${p => (p.reloading ? 0.5 : 1)};
  pointer-events: ${p => (p.reloading ? 'none' : 'auto')};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: flex;
  }
`;

const ReleaseInfo = styled('div')`
  padding: ${space(1.5)} ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    border-right: 1px solid ${p => p.theme.border};
    min-width: 250px;
    width: 25%;
  }
  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    min-width: 300px;
  }
`;

const ReleaseInfoSubheader = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray400};
`;

const StyledDeployBadge = styled(DeployBadge)`
  margin-right: ${space(0.5)};
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

export default ReleaseCard;
