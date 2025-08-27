import styled from '@emotion/styled';
import invariant from 'invariant';

import ReplayBadge from 'sentry/components/replays/replayBadge';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';
import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  onClick: () => void;
  replay: ReplayListRecord | ReplayListRecordWithTx;
  rowIndex: number;
}

export default function ReplayListItem({replay, onClick}: Props) {
  const organization = useOrganization();

  const replayDetailsPathname = makeReplaysPathname({
    path: `/${replay.id}/`,
    organization,
  });

  if (replay.is_archived) {
    return <ReplayBadge replay={replay} />;
  }

  invariant(
    replay.started_at,
    'For TypeScript: replay.started_at is implied because replay.is_archived is false'
  );

  return (
    <CardSpacing>
      <a
        href={replayDetailsPathname}
        onClick={e => {
          e.preventDefault();
          onClick();
        }}
      >
        <ReplayBadge replay={replay} />
      </a>
    </CardSpacing>
  );
}

const CardSpacing = styled('div')`
  position: relative;
  padding: ${space(0.5)} ${space(0.5)} 0 ${space(0.5)};
`;
