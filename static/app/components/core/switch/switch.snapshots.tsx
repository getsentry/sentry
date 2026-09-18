import {Switch, type SwitchProps} from '@sentry/scraps/switch';

describe('Switch', () => {
  it.snapshot.each<SwitchProps['size']>(['sm', 'lg'])(
    'size-%s-unchecked',
    size => <Switch size={size} onChange={() => {}} />,
    size => ({tags: {size: String(size), area: 'core'}})
  );

  it.snapshot.each<SwitchProps['size']>(['sm', 'lg'])(
    'size-%s-checked',
    size => <Switch checked size={size} onChange={() => {}} />,
    size => ({tags: {size: String(size), checked: 'true', area: 'core'}})
  );

  it.snapshot('disabled-unchecked', () => <Switch disabled onChange={() => {}} />, {
    tags: {disabled: 'true', area: 'core'},
  });

  it.snapshot('disabled-checked', () => <Switch checked disabled onChange={() => {}} />, {
    tags: {disabled: 'true', checked: 'true', area: 'core'},
  });
});
