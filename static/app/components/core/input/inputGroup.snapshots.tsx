import {InputGroup} from '@sentry/scraps/input';
import type {InputProps} from '@sentry/scraps/input';

import {IconSearch} from 'sentry/icons';

describe('InputGroup', () => {
  it.snapshot.each<InputProps['size']>(['md', 'sm', 'xs'])(
    'size-%s',
    size => (
      <div style={{padding: 8, width: 300}}>
        <InputGroup>
          <InputGroup.Input size={size} placeholder={`size ${size}`} />
        </InputGroup>
      </div>
    ),
    size => ({tags: {size: String(size), area: 'core'}})
  );

  it.snapshot(
    'disabled',
    () => (
      <div style={{padding: 8, width: 300}}>
        <InputGroup>
          <InputGroup.Input disabled placeholder="Disabled input" />
        </InputGroup>
      </div>
    ),
    {tags: {disabled: 'true', area: 'core'}}
  );

  it.snapshot(
    'with-leading-items',
    () => (
      <div style={{padding: 8, width: 300}}>
        <InputGroup>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSearch />
          </InputGroup.LeadingItems>
          <InputGroup.Input placeholder="Search…" />
        </InputGroup>
      </div>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'with-leading-items-disabled',
    () => (
      <div style={{padding: 8, width: 300}}>
        <InputGroup>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSearch />
          </InputGroup.LeadingItems>
          <InputGroup.Input disabled placeholder="Search…" />
        </InputGroup>
      </div>
    ),
    {tags: {disabled: 'true', area: 'core'}}
  );
});
