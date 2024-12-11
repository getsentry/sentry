import {Fragment} from 'react';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import type {Fingerprint} from 'sentry/stores/groupingStore';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';

import MergedItem from './mergedItem';
import {MergedToolbar} from './mergedToolbar';

type Props = {
  groupId: Group['id'];
  /**
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
  const location = useLocation();
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
      <Panel>
        <MergedToolbar
          onToggleCollapse={onToggleCollapse}
          onUnmerge={onUnmerge}
          orgId={organization.slug}
          project={project}
          groupId={groupId}
          location={location}
        />

        <PanelBody>
          {fingerprintsWithLatestEvent.map(fingerprint => (
            <MergedItem
              key={fingerprint.id}
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

export default MergedList;
