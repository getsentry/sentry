import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import type {InternetProtocol} from 'sentry/types/user';

export function SessionRow({
  ipAddress,
  lastSeen,
  firstSeen,
  countryCode,
  regionCode,
}: Omit<InternetProtocol, 'id'>) {
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        <Stack gap="xs">
          <Text bold wordBreak="break-word">
            {ipAddress}
          </Text>
          {countryCode && regionCode && (
            <Text size="sm">{`${countryCode} (${regionCode})`}</Text>
          )}
        </Stack>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Text size="sm">
          <TimeSince date={firstSeen} />
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Text size="sm">
          <TimeSince date={lastSeen} />
        </Text>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}
