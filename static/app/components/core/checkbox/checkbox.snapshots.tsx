import {Checkbox, type CheckboxProps} from '@sentry/scraps/checkbox';
import {Container} from '@sentry/scraps/layout';

describe('Checkbox', () => {
  describe.each([
    {mode: 'editable', disabled: false, readOnly: false},
    {mode: 'disabled', disabled: true, readOnly: false},
    {mode: 'read-only', disabled: false, readOnly: true},
  ])('$mode interaction feedback', ({mode, disabled, readOnly}) => {
    describe.each([false, true])('checked %s', checked => {
      it.snapshot.each(['hover', 'active'] as const)(
        '%s',
        () => (
          <Container padding="md">
            <Checkbox
              aria-label="Example checkbox"
              checked={checked}
              disabled={disabled}
              readOnly={readOnly}
              onChange={() => {}}
            />
          </Container>
        ),
        state => ({
          tags: {mode, checked: String(checked), state, area: 'core'},
          interaction: {[state]: 'input[type="checkbox"]'},
        })
      );
    });
  });

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
