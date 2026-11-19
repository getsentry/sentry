import type {ReactNode} from 'react';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconSearch} from '@sentry/icons/search';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
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

  it.snapshot.each(['xs', 'sm', 'md'] as const)(
    'leading icon alignment at size %s',
    size => (
      <Stack padding="md" width="300px">
        <Select
          aria-label="Search environments"
          placeholder="Search environments"
          options={options}
          value={null}
          size={size}
          controlLeadingItems={
            <Container paddingLeft="lg" flexShrink={0}>
              <IconSearch size="sm" variant="muted" aria-hidden />
            </Container>
          }
          onChange={() => {}}
        />
      </Stack>
    ),
    size => ({tags: {area: 'core', size, state: 'leading-icon'}})
  );

  it.snapshot.each(['xs', 'sm', 'md'] as const)(
    'selected chips at size %s',
    size => (
      <Stack padding="md" width="300px">
        <Select
          aria-label="Environments"
          options={options}
          value={['production', 'staging']}
          size={size}
          multiple
          onChange={() => {}}
        />
      </Stack>
    ),
    size => ({tags: {area: 'core', size, state: 'selected-chips'}})
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
          aria-label="Empty environments"
          placeholder="Select environments"
          options={options}
          value={[]}
          multiple
          onChange={() => {}}
        />
        <Select
          aria-label="Environments"
          options={options}
          value={['production', 'staging']}
          multiple
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

  it.snapshot(
    'open multi-select with checked and unchecked options',
    () => (
      <Stack padding="md" width="300px" height="200px">
        <Select
          aria-label="Environments"
          options={options}
          value={['production']}
          multiple
          isOpen
          styles={{menu: base => ({...base, position: 'initial'})}}
          onChange={() => {}}
        />
      </Stack>
    ),
    {tags: {area: 'core', state: 'open-multiple'}}
  );
});
