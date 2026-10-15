import {Checkbox, type CheckboxProps} from '@sentry/scraps/checkbox';

describe('Checkbox', () => {
  it.snapshot.each<CheckboxProps['checked']>([false, true, 'indeterminate'])(
    'checked-%s',
    checked => (
      <div style={{padding: 8}}>
        <Checkbox checked={checked} onChange={() => {}} />
      </div>
    ),
    checked => ({tags: {checked: String(checked), area: 'core'}})
  );

  it.snapshot.each<CheckboxProps['size']>(['xs', 'sm', 'md'])(
    'size-%s',
    size => (
      <div style={{padding: 8}}>
        <Checkbox checked size={size} onChange={() => {}} />
      </div>
    ),
    size => ({tags: {size: String(size), area: 'core'}})
  );

  it.snapshot(
    'disabled-unchecked',
    () => (
      <div style={{padding: 8}}>
        <Checkbox disabled onChange={() => {}} />
      </div>
    ),
    {tags: {disabled: 'true', area: 'core'}}
  );

  it.snapshot(
    'disabled-checked',
    () => (
      <div style={{padding: 8}}>
        <Checkbox checked disabled onChange={() => {}} />
      </div>
    ),
    {tags: {disabled: 'true', checked: 'true', area: 'core'}}
  );
});
