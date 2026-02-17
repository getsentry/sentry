import {Fragment} from 'react';

import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

export function TimeInput() {
  return (
    <Fragment>
      <Stack gap="sm">
        <Text bold>Start</Text>
        <Flex gap="xs" width="100%">
          <Input name="start_date" type="date" placeholder="Start Date" />
          <Input name="start_time" type="time" placeholder="Start" />
        </Flex>
      </Stack>

      <Stack gap="sm">
        <Text bold>End</Text>
        <Flex gap="xs" width="100%">
          <Input name="end_date" type="date" placeholder="End Date" />
          <Input name="end_time" type="time" placeholder="End" />
        </Flex>
      </Stack>
    </Fragment>
  );
}
