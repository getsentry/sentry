import React from 'react';
import {Location} from 'history';
import flatten from 'lodash/flatten';
import partition from 'lodash/partition';

import {GlobalSelection, Release} from 'app/types';

import {DisplayOption} from '../utils';

import Content from './content';

type Props = {
  release: Release;
  orgSlug: string;
  activeDisplay: DisplayOption;
  location: Location;
  showPlaceholders: boolean;
  selection: GlobalSelection;
};

const ReleaseHealth = ({
  release,
  orgSlug,
  activeDisplay,
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

  return (
    <Content
      activeDisplay={activeDisplay}
      orgSlug={orgSlug}
      releaseVersion={release.version}
      projects={sortedProjects}
      location={location}
      showPlaceholders={showPlaceholders}
    />
  );
};

export default ReleaseHealth;
