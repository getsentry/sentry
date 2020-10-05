import React from 'react';
import {Location} from 'history';
import partition from 'lodash/partition';
import flatten from 'lodash/flatten';

import {Release, GlobalSelection} from 'app/types';

import Content from './content';
import CompactContent from './compactContent';

type Props = {
  release: Release;
  orgSlug: string;
  location: Location;
  showPlaceholders: boolean;
  selection: GlobalSelection;
};

const ReleaseHealth = ({
  release,
  orgSlug,
  location,
  selection,
  showPlaceholders,
}: Props) => {
  // sort health rows inside release card alphabetically by project name,
  // but put the ones with project selected in global header to top
  const sortedProjects = flatten(
    partition(
      release.projects.sort((a, b) => a.slug.localeCompare(b.slug)),
      p => selection.projects.includes(p.id)
    )
  );

  const hasAtLeastOneHealthData = sortedProjects.some(
    sortedProject => sortedProject.hasHealthData
  );

  const contentProps = {
    projects: sortedProjects,
    releaseVersion: release.version,
    orgSlug,
  };

  if (hasAtLeastOneHealthData) {
    return (
      <Content
        {...contentProps}
        location={location}
        showPlaceholders={showPlaceholders}
      />
    );
  }

  return <CompactContent {...contentProps} />;
};

export default ReleaseHealth;
