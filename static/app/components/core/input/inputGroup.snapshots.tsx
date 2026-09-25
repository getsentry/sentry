import {Chip} from '@sentry/scraps/chip';
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

  it.snapshot.each<InputProps['size']>(['md', 'sm', 'xs'])(
    'with-trailing-items-size-%s',
    size => (
      <div style={{padding: 8, width: 300}}>
        <InputGroup>
          <InputGroup.Input size={size} placeholder="Search…" />
          <InputGroup.TrailingItems disablePointerEvents>
            <IconSearch />
          </InputGroup.TrailingItems>
        </InputGroup>
      </div>
    ),
    size => ({tags: {size: String(size), area: 'core'}})
  );

  it.snapshot('with-leading-and-trailing-items', () => (
    <div style={{padding: 8, width: 300}}>
      <InputGroup>
        <InputGroup.LeadingItems disablePointerEvents>
          <IconSearch />
        </InputGroup.LeadingItems>
        <InputGroup.Input />
        <InputGroup.TrailingItems disablePointerEvents>
          <IconSearch />
        </InputGroup.TrailingItems>
      </InputGroup>
    </div>
  ));

  it.snapshot('textarea-with-leading-and-trailing-items', () => (
    <div style={{padding: 8, width: 300}}>
      <InputGroup>
        <InputGroup.LeadingItems disablePointerEvents>
          <IconSearch />
        </InputGroup.LeadingItems>
        <InputGroup.TextArea />
        <InputGroup.TrailingItems disablePointerEvents>
          <IconSearch />
        </InputGroup.TrailingItems>
      </InputGroup>
    </div>
  ));

  it.snapshot('with-leading-chip', () => (
    <div style={{padding: 8, width: 300}}>
      <InputGroup>
        <InputGroup.LeadingItems>
          <Chip value="Chrome" />
        </InputGroup.LeadingItems>
        <InputGroup.Input />
      </InputGroup>
    </div>
  ));
});
