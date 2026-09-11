import {useState} from 'react';
import {ClassNames} from '@emotion/react';
import {useInfiniteQuery} from '@tanstack/react-query';
import {duration} from 'moment-timezone';
import {ReplayListFixture} from 'sentry-fixture/replayList';

import {Flex, Stack} from '@sentry/scraps/layout';

import {Hovercard} from 'sentry/components/hovercard';
import {ReplayList} from 'sentry/components/replays/list/__stories__/replayList';
import * as Storybook from 'sentry/stories';
import type {ReplayListRecord} from 'sentry/views/explore/replays/types';

const PAGE_SIZE = 10;
const PAGE_COUNT = 3;
const NEWEST_STARTED_AT = new Date('2022-09-15T06:50:03+00:00');
const USERS = ['alice', 'bob', 'carol', 'dmitri', 'erin'];
const BROWSERS = ['Firefox', 'Chrome', 'Safari', 'Edge'];

/**
 * Several pages of replays derived from the fixture record, varied
 * deterministically so the list has some texture (different users, browsers,
 * durations, activity) without depending on any org's real data.
 */
function replayPage(page: number): ReplayListRecord[] {
  const [template] = ReplayListFixture();
  return Array.from({length: PAGE_SIZE}, (_, index) => {
    const n = page * PAGE_SIZE + index;
    const startedAt = new Date(NEWEST_STARTED_AT.getTime() - n * 17 * 60 * 1000);
    const seconds = 30 + n * 11;
    return {
      ...template!,
      id: `${n.toString(16).padStart(4, '0')}${template!.id.slice(4)}`,
      activity: (n * 7) % 10,
      count_errors: n % 4 === 0 ? (n % 3) + 1 : 0,
      count_rage_clicks: n % 5 === 0 ? 1 : 0,
      browser: {name: BROWSERS[n % BROWSERS.length]!, version: '111.0'},
      duration: duration(seconds, 'seconds'),
      started_at: startedAt,
      finished_at: new Date(startedAt.getTime() + seconds * 1000),
      has_viewed: n % 3 === 0,
      user: {
        ...template!.user,
        id: String(147086 + n),
        display_name: USERS[n % USERS.length]!,
        username: USERS[n % USERS.length]!,
      },
    };
  });
}

/**
 * Serves the fixture pages through the same infinite query shape the real
 * replay list endpoint produces, so `ReplayList` renders exactly as in the app.
 */
function useFixtureReplayList() {
  return useInfiniteQuery({
    queryKey: ['stories', 'replay-list'],
    queryFn: async ({
      pageParam,
    }): Promise<{headers: {Link?: string}; json: {data: ReplayListRecord[]}}> => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return {headers: {}, json: {data: replayPage(pageParam)}};
    },
    initialPageParam: 0,
    getNextPageParam: (_lastPage, _pages, lastPageParam) =>
      lastPageParam + 1 < PAGE_COUNT ? lastPageParam + 1 : undefined,
    staleTime: Infinity,
  });
}

export default Storybook.story('ReplayList', story => {
  story('Rendered', () => {
    const [replayId, setReplayId] = useState<string | undefined>();
    const queryResult = useFixtureReplayList();

    return (
      <Stack gap="md">
        Selected Replay: {replayId}
        <Flex height="500px">
          <Stack gap="md" flex="1">
            <ReplayList onSelect={setReplayId} queryResult={queryResult} />
          </Stack>
        </Flex>
      </Stack>
    );
  });

  story('Hovercard', () => {
    const [replayId, setReplayId] = useState<string | undefined>();
    const queryResult = useFixtureReplayList();

    return (
      <ClassNames>
        {({css}) => (
          <Hovercard
            body={
              <Flex height="500px">
                <Stack gap="md" flex="1">
                  <ReplayList onSelect={setReplayId} queryResult={queryResult} />
                </Stack>
              </Flex>
            }
            containerClassName={css`
              width: max-content;
            `}
          >
            Selected Replay: {replayId}
          </Hovercard>
        )}
      </ClassNames>
    );
  });
});
