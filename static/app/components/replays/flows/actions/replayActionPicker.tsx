import {type ReactNode} from 'react';
import {ClassNames} from '@emotion/react';

import {Flex} from 'sentry/components/core/layout';
import {Hovercard} from 'sentry/components/hovercard';
import ReplayList from 'sentry/components/replays/list/replayList';
import useReplayTableSort from 'sentry/components/replays/table/useReplayTableSort';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useReplayListQueryKey from 'sentry/utils/replays/hooks/useReplayListQueryKey';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  children: ReactNode;
  onSelect: (replayId: string) => void;
  projectId: string;
}

export default function ReplayActionPicker({children, onSelect, projectId}: Props) {
  const organization = useOrganization();

  const {sortQuery} = useReplayTableSort();
  const query = useLocationQuery({
    fields: {
      cursor: decodeScalar,
      end: decodeScalar,
      query: decodeScalar,
      start: decodeScalar,
      statsPeriod: decodeScalar,
      utc: decodeScalar,
    },
  });
  const listQueryKey = useReplayListQueryKey({
    options: {
      query: {
        project: [projectId],
        ...query,
        sort: sortQuery,
      },
    },
    organization,
    queryReferrer: 'replayList',
  });
  const queryResult = useInfiniteApiQuery<{data: ReplayListRecord[]}>({
    queryKey: ['infinite', ...(listQueryKey ?? '')],
    enabled: Boolean(listQueryKey),
  });

  return (
    <ClassNames>
      {({css}) => (
        <Hovercard
          body={
            <Flex direction="column" gap="md">
              <Flex gap="sm" />
              <Flex style={{height: 500}}>
                <Flex direction="column" gap="md" flex="1">
                  <ReplayList onSelect={onSelect} queryResult={queryResult} />
                </Flex>
              </Flex>
            </Flex>
          }
          containerClassName={css`
            width: max-content;
          `}
        >
          {children}
        </Hovercard>
      )}
    </ClassNames>
  );
}
