import React from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'app/components/emptyStateWarning';
import Pagination from 'app/components/pagination';
import {Panel} from 'app/components/panels';
import QueryCount from 'app/components/queryCount';
import {t} from 'app/locale';
import {Fingerprint} from 'app/stores/groupingStore';
import {Organization, Project} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import MergedItem from './mergedItem';
import MergedToolbar from './mergedToolbar';

type Props = {
  /**
   * From GroupMergedView -> handleUnmerge
   */
  onUnmerge: () => void;
  /*
   * From GroupingActions.toggleCollapseFingerprints
   */
  onToggleCollapse: () => void;
  organization: Organization;
  project: Project;
  fingerprints?: Fingerprint[];
  pageLinks?: string;
};

function MergedList({
  fingerprints = [],
  pageLinks,
  onToggleCollapse,
  onUnmerge,
  organization,
  project,
}: Props) {
  const fingerprintsWithLatestEvent = fingerprints.filter(
    ({latestEvent}) => !!latestEvent
  );
  const hasResults = fingerprintsWithLatestEvent.length > 0;

  if (!hasResults) {
    return (
      <Panel>
        <EmptyStateWarning>
          <p>{t("There don't seem to be any hashes for this issue.")}</p>
        </EmptyStateWarning>
      </Panel>
    );
  }

  return (
    <React.Fragment>
      <h2>
        <span>{t('Merged fingerprints with latest event')}</span>{' '}
        <QueryCount count={fingerprintsWithLatestEvent.length} />
      </h2>

      <MergedToolbar
        onToggleCollapse={onToggleCollapse}
        onUnmerge={onUnmerge}
        orgId={organization.slug}
        project={project}
      />

      <MergedItems>
        {fingerprintsWithLatestEvent.map(({id, latestEvent}) => (
          <MergedItem
            key={id}
            organization={organization}
            disabled={fingerprintsWithLatestEvent.length === 1}
            event={latestEvent}
            fingerprint={id}
          />
        ))}
      </MergedItems>
      {pageLinks && <Pagination pageLinks={pageLinks} />}
    </React.Fragment>
  );
}

export default withOrganization(MergedList);

const MergedItems = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-top: none;
`;
