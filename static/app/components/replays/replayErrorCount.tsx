import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {IconFire} from 'sentry/icons/iconFire';

/**
 * A replay's error count, flagged with the fire icon once there is anything to
 * flag. Shared between the replays table and the Seer `replaysQuery` embed so
 * a count reads the same wherever it appears.
 */
export function ReplayErrorCount({count}: {count: null | number}) {
  return (
    <TabularNumber>
      {count ? (
        <Flex align="center" gap="xs">
          <IconFire variant="danger" />
          {count}
        </Flex>
      ) : (
        0
      )}
    </TabularNumber>
  );
}

const TabularNumber = styled('div')`
  font-variant-numeric: tabular-nums;
`;
