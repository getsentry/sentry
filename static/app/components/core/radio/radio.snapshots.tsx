import {Radio} from '@sentry/scraps/radio';

describe('Radio', () => {
  it.snapshot.each<'xs' | 'sm' | 'md'>(['xs', 'sm', 'md'])(
    'size-%s-unchecked',
    size => (
      <div style={{padding: 8}}>
        <Radio size={size} onChange={() => {}} />
      </div>
    ),
    size => ({tags: {size, area: 'core'}})
  );

  it.snapshot.each<'xs' | 'sm' | 'md'>(['xs', 'sm', 'md'])(
    'size-%s-checked',
    size => (
      <div style={{padding: 8}}>
        <Radio checked size={size} onChange={() => {}} />
      </div>
    ),
    size => ({tags: {size, checked: 'true', area: 'core'}})
  );

  it.snapshot(
    'disabled-unchecked',
    () => (
      <div style={{padding: 8}}>
        <Radio disabled onChange={() => {}} />
      </div>
    ),
    {tags: {disabled: 'true', area: 'core'}}
  );

  it.snapshot(
    'disabled-checked',
    () => (
      <div style={{padding: 8}}>
        <Radio checked disabled onChange={() => {}} />
      </div>
    ),
    {tags: {disabled: 'true', checked: 'true', area: 'core'}}
  );
});
