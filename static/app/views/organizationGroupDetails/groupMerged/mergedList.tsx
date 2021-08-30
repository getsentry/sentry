import {Fragment} from 'react';

import EmptyStateWarning from 'app/components/emptyStateWarning';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody} from 'app/components/panels';
import QueryCount from 'app/components/queryCount';
import {t} from 'app/locale';
import {Fingerprint} from 'app/stores/groupingStore';
import {Group, Organization, Project} from 'app/types';
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
  groupId: Group['id'];
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
      <h2>
        <span>{t('Merged fingerprints with latest event')}</span>{' '}
        <QueryCount count={fingerprintsWithLatestEvent.length} />
      </h2>

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
            />
          ))}
        </PanelBody>
      </Panel>
      {pageLinks && <Pagination pageLinks={pageLinks} />}
    </Fragment>
  );
}

export default withOrganization(MergedList);
