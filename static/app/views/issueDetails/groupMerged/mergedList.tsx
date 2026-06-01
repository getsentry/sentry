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
import {hasLatestEvent, type Fingerprint, type GroupMergedState} from './useGroupMerged';

type Props = {
  enableFingerprintCompare: boolean;
  groupId: Group['id'];
  onToggleCollapse: () => void;
  onUnmerge: () => void;
  project: Project;
  state: GroupMergedState;
  toggleCollapsed: (fingerprintId: string) => void;
  toggleSelected: (fingerprintId: string, eventId: string) => void;
  unmergeDisabled: boolean;
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
  enableFingerprintCompare,
  state,
  toggleCollapsed,
  toggleSelected,
  unmergeDisabled,
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
          enableFingerprintCompare={enableFingerprintCompare}
          fingerprints={fingerprints}
          onToggleCollapse={onToggleCollapse}
          onUnmerge={onUnmerge}
          project={project}
          groupId={groupId}
          state={state}
          unmergeDisabled={unmergeDisabled}
        />

        <PanelBody>
          {fingerprintsWithLatestEvent.map(fingerprint => (
            <MergedItem
              key={fingerprint.id}
              fingerprint={fingerprint}
              state={state}
              toggleCollapsed={toggleCollapsed}
              toggleSelected={toggleSelected}
              totalFingerprint={fingerprintsWithLatestEvent.length}
            />
          ))}
        </PanelBody>
      </Panel>
      {pageLinks && <Pagination pageLinks={pageLinks} />}
    </Fragment>
  );
}
