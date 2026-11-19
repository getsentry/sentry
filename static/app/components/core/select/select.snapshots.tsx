import type {ReactNode} from 'react';
import {IconCheckmark} from '@sentry/icons/checkmark';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';

const options = [
  {label: 'Production', value: 'production'},
  {label: 'Staging', value: 'staging'},
];

function SavedIndicators({children}: {children: ReactNode}) {
  return (
    <Flex padding="0 sm" gap="sm" align="center">
      <IconCheckmark variant="success" size="sm" />
      {children}
    </Flex>
  );
}

describe('Select', () => {
  it.snapshot.each(['xs', 'sm', 'md'] as const)(
    'saved indicator alignment at size %s',
    size => (
      <Stack padding="md" width="300px">
        <Select
          aria-label="Environment"
          options={options}
          value="production"
          size={size}
          components={{Indicators: SavedIndicators}}
          onChange={() => {}}
        />
      </Stack>
    ),
    size => ({tags: {area: 'core', size, state: 'saved'}})
  );

  it.snapshot(
    'empty, clearable multiple, and disabled',
    () => (
      <Stack padding="md" gap="md" width="300px">
        <Select
          aria-label="Environment"
          placeholder="Select an environment"
          options={options}
          value={null}
          onChange={() => {}}
        />
        <Select
          aria-label="Environments"
          options={options}
          value={['production', 'staging']}
          multiple
          clearable
          onChange={() => {}}
        />
        <Select
          aria-label="Disabled environment"
          options={options}
          value="production"
          disabled
        />
      </Stack>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'open grouped menu with a selected option',
    () => (
      <Stack padding="md" width="300px" height="200px">
        <Select
          aria-label="Environment"
          options={[{label: 'Deployment', options}]}
          value="production"
          isOpen
          styles={{menu: base => ({...base, position: 'initial'})}}
          onChange={() => {}}
        />
      </Stack>
    ),
    {tags: {area: 'core', state: 'open'}}
  );
});
