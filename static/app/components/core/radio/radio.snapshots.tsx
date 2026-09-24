import {Radio} from '@sentry/scraps/radio';

describe('Radio', () => {
  it.snapshot.each<'xs' | 'sm' | 'md'>(['xs', 'sm', 'md'])(
    'size-%s-unchecked',
    size => <Radio size={size} onChange={() => {}} />,
    size => ({tags: {size, area: 'core'}})
  );

  it.snapshot.each<'xs' | 'sm' | 'md'>(['xs', 'sm', 'md'])(
    'size-%s-checked',
    size => <Radio checked size={size} onChange={() => {}} />,
    size => ({tags: {size, checked: 'true', area: 'core'}})
  );

  it.snapshot('disabled-unchecked', () => <Radio disabled onChange={() => {}} />, {
    tags: {disabled: 'true', area: 'core'},
  });

  it.snapshot('disabled-checked', () => <Radio checked disabled onChange={() => {}} />, {
    tags: {disabled: 'true', checked: 'true', area: 'core'},
  });
});
