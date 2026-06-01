import styled from '@emotion/styled';

import {Pagination} from '@sentry/scraps/pagination';

import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {parseCursor} from 'sentry/utils/cursor';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

import {MergedItem} from './mergedItem';
import {MergedToolbar} from './mergedToolbar';
import {
  hasLatestEvent,
  MERGED_HASH_LIMIT,
  type Fingerprint,
  type GroupMergedState,
} from './useGroupMerged';

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
  const location = useLocation();
  const fingerprintsWithLatestEvent = fingerprints.filter(hasLatestEvent);
  const hasResults = fingerprintsWithLatestEvent.length > 0;
  const paginationCaption = getMergedHashesPaginationCaption({
    cursor: decodeScalar(location.query.cursor),
    pageLength: fingerprintsWithLatestEvent.length,
    pageLinks,
  });

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
      </MergedPanel>
      <Pagination caption={paginationCaption} pageLinks={pageLinks} />
    </div>
  );
}

function getMergedHashesPaginationCaption({
  cursor,
  pageLength,
  pageLinks,
}: {
  cursor: string | undefined;
  pageLength: number;
  pageLinks: string | undefined;
}) {
  if (!pageLinks || pageLength === 0) {
    return;
  }

  const offset = parseCursor(cursor)?.offset ?? 0;
  const end = offset * MERGED_HASH_LIMIT + pageLength;
  const links = parseLinkHeader(pageLinks);

  if (links.next?.results === false) {
    return tct('[count] of [total]', {
      count: end.toLocaleString(),
      total: end.toLocaleString(),
    });
  }

  return tct('[count] shown', {count: end.toLocaleString()});
}

const MergedPanel = styled(Panel)`
  margin-bottom: 0;
  overflow: hidden;
`;
