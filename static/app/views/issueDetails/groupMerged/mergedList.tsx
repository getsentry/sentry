import styled from '@emotion/styled';

import {Pagination} from '@sentry/scraps/pagination';

import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

import {MergedItem} from './mergedItem';
import {MergedToolbar} from './mergedToolbar';
import {
  type FingerprintWithLatestEvent,
  type GroupMergedState,
  useMergedCursor,
} from './useGroupMerged';

type Props = {
  enableFingerprintCompare: boolean;
  fingerprints: FingerprintWithLatestEvent[];
  groupId: Group['id'];
  onToggleCollapse: () => void;
  onUnmerge: () => void;
  project: Project;
  state: GroupMergedState;
  toggleCollapsed: (fingerprintId: string) => void;
  toggleSelected: (fingerprintId: string, eventId: string) => void;
  unmergeDisabled: boolean;
  pageLinks?: string;
};

export function MergedList({
  fingerprints,
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
  const [, setCursor] = useMergedCursor();
  const hasResults = fingerprints.length > 0;
  const canSelect = fingerprints.length > 1;

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
    <div>
      <MergedPanel>
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
          {fingerprints.map(fingerprint => (
            <MergedItem
              key={fingerprint.id}
              canSelect={canSelect}
              fingerprint={fingerprint}
              state={state}
              toggleCollapsed={toggleCollapsed}
              toggleSelected={toggleSelected}
            />
          ))}
        </PanelBody>
      </MergedPanel>
      <Pagination pageLinks={pageLinks} onCursor={cursor => setCursor(cursor ?? null)} />
    </div>
  );
}

const MergedPanel = styled(Panel)`
  margin-bottom: 0;
  overflow: hidden;
`;
