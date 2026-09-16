import {Checkbox, type CheckboxProps} from '@sentry/scraps/checkbox';

describe('Checkbox', () => {
  it.snapshot.each<CheckboxProps['checked']>([false, true, 'indeterminate'])(
    'checked-%s',
    checked => <Checkbox checked={checked} onChange={() => {}} />,
    checked => ({tags: {checked: String(checked), area: 'core'}})
  );

  it.snapshot.each<CheckboxProps['size']>(['xs', 'sm', 'md'])(
    'size-%s',
    size => <Checkbox checked size={size} onChange={() => {}} />,
    size => ({tags: {size: String(size), area: 'core'}})
  );

  it.snapshot('disabled-unchecked', () => <Checkbox disabled onChange={() => {}} />, {
    tags: {disabled: 'true', area: 'core'},
  });

  it.snapshot(
    'disabled-checked',
    () => <Checkbox checked disabled onChange={() => {}} />,
    {tags: {disabled: 'true', checked: 'true', area: 'core'}}
  );
});
