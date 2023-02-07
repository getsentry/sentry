import {Fragment} from 'react';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody} from 'sentry/components/panels';
import QueryCount from 'sentry/components/queryCount';
import {t} from 'sentry/locale';
import {Fingerprint} from 'sentry/stores/groupingStore';
import {Group, Organization, Project} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

import MergedItem from './mergedItem';
import {MergedToolbar} from './mergedToolbar';

type Props = {
  groupId: Group['id'];
  /*
   * From GroupingStore.onToggleCollapseFingerprints
   */
  onToggleCollapse: () => void;
  /**
   * From GroupMergedView -> handleUnmerge
   */
  onUnmerge: () => void;
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
  groupId,
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
    <Fragment>
      <h4>
        <span>{t('Merged fingerprints with latest event')}</span>{' '}
        <QueryCount count={fingerprintsWithLatestEvent.length} />
      </h4>

      <Panel>
        <MergedToolbar
          onToggleCollapse={onToggleCollapse}
          onUnmerge={onUnmerge}
          orgId={organization.slug}
          project={project}
          groupId={groupId}
        />

        <PanelBody>
          {fingerprintsWithLatestEvent.map(fingerprint => (
            <MergedItem
              key={fingerprint.id}
              organization={organization}
              fingerprint={fingerprint}
              totalFingerprint={fingerprintsWithLatestEvent.length}
            />
          ))}
        </PanelBody>
      </Panel>
      {pageLinks && <Pagination pageLinks={pageLinks} />}
    </Fragment>
  );
}

export default withOrganization(MergedList);
