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
import {type FingerprintWithLatestEvent, type GroupMergedState} from './useGroupMerged';

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
  const location = useLocation();
  const hasResults = fingerprints.length > 0;
  const canSelect = fingerprints.length > 1;
  const paginationCaption = getMergedHashesPaginationCaption({
    cursor: decodeScalar(location.query.cursor),
    pageLength: fingerprints.length,
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
  const end = offset + pageLength;
  const links = parseLinkHeader(pageLinks);

  if (links.next?.results !== false) {
    return;
  }

  return tct('[count] of [total]', {
    count: end.toLocaleString(),
    total: end.toLocaleString(),
  });
}

const MergedPanel = styled(Panel)`
  margin-bottom: 0;
  overflow: hidden;
`;
