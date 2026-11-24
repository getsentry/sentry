import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconSearch} from '@sentry/icons/search';

import {Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import type {FormSize} from '@sentry/scraps/theme';

const options = [
  {label: 'Production', value: 'production'},
  {label: 'Staging', value: 'staging'},
];

const deliveryOptions = [
  {label: 'Email', value: 'email'},
  {label: 'Slack', value: 'slack'},
];

function renderOpenMultiSelect(
  size: FormSize,
  label: string,
  choices: typeof options,
  selectedValue: string
) {
  return (
    <Stack padding="md" width="300px" height="200px">
      <Select
        aria-label={label}
        options={choices}
        value={[selectedValue]}
        size={size}
        multiple
        isOpen
        styles={{menu: base => ({...base, position: 'initial'})}}
        onChange={() => {}}
      />
    </Stack>
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
          trailingItems={<IconCheckmark variant="success" size="sm" aria-hidden />}
          onChange={() => {}}
        />
      </Stack>
    ),
    size => ({tags: {area: 'core', size, state: 'saved'}})
  );

  it.snapshot.each(['xs', 'sm', 'md'] as const)(
    'clear indicator alignment at size %s',
    size => (
      <Stack padding="md" width="300px">
        <Select
          aria-label="Environment"
          options={options}
          value="production"
          size={size}
          clearable
          onChange={() => {}}
        />
      </Stack>
    ),
    size => ({tags: {area: 'core', size, state: 'clearable'}})
  );

  it.snapshot.each(['xs', 'sm', 'md'] as const)(
    'loading indicator alignment at size %s',
    size => (
      <Stack padding="md" width="300px">
        <Select
          aria-label="Repository"
          placeholder="Search repositories"
          options={[]}
          value={null}
          size={size}
          isLoading
          onChange={() => {}}
        />
      </Stack>
    ),
    size => ({tags: {area: 'core', size, state: 'loading'}})
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
          leadingItems={<IconSearch size="sm" variant="muted" aria-hidden />}
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
    () => renderOpenMultiSelect('md', 'Environments', options, 'production'),
    {tags: {area: 'core', size: 'md', state: 'open-multiple'}}
  );

  it.snapshot.each(['xs', 'sm'] as const)(
    'open multi-select with checked and unchecked options at size %s',
    size => renderOpenMultiSelect(size, 'Delivery Method', deliveryOptions, 'email'),
    size => ({tags: {area: 'core', size, state: 'open-multiple'}})
  );
});
