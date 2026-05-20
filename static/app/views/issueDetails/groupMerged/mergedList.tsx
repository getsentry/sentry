import {Fragment} from 'react';

import {Pagination} from '@sentry/scraps/pagination';

import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

import {MergedItem} from './mergedItem';
import {MergedToolbar} from './mergedToolbar';
import {hasLatestEvent, type Fingerprint} from './useGroupMerged';

type Props = {
  groupId: Group['id'];
  onToggleCollapse: () => void;
  /**
   * From GroupMergedView -> handleUnmerge
   */
  onUnmerge: () => void;
  project: Project;
  fingerprints?: Fingerprint[];
  pageLinks?: string;
};

export function MergedList({
  fingerprints = [],
  pageLinks,
  onToggleCollapse,
  onUnmerge,
  groupId,
  project,
}: Props) {
  const fingerprintsWithLatestEvent = fingerprints.filter(hasLatestEvent);
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
      <Panel>
        <MergedToolbar
          onToggleCollapse={onToggleCollapse}
          onUnmerge={onUnmerge}
          project={project}
          groupId={groupId}
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
