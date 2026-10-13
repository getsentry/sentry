import {Switch, type SwitchProps} from '@sentry/scraps/switch';

describe('Switch', () => {
  it.snapshot.each<SwitchProps['size']>(['sm', 'lg'])(
    'size-%s-unchecked',
    size => (
      <div style={{padding: 8}}>
        <Switch size={size} onChange={() => {}} />
      </div>
    ),
    size => ({tags: {size: String(size), area: 'core'}})
  );

  it.snapshot.each<SwitchProps['size']>(['sm', 'lg'])(
    'size-%s-checked',
    size => (
      <div style={{padding: 8}}>
        <Switch checked size={size} onChange={() => {}} />
      </div>
    ),
    size => ({tags: {size: String(size), checked: 'true', area: 'core'}})
  );

  it.snapshot(
    'disabled-unchecked',
    () => (
      <div style={{padding: 8}}>
        <Switch disabled onChange={() => {}} />
      </div>
    ),
    {tags: {disabled: 'true', area: 'core'}}
  );

  it.snapshot(
    'disabled-checked',
    () => (
      <div style={{padding: 8}}>
        <Switch checked disabled onChange={() => {}} />
      </div>
    ),
    {tags: {disabled: 'true', checked: 'true', area: 'core'}}
  );
});
