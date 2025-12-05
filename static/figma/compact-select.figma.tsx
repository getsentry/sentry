import figma from '@figma/code-connect';

import {CompactSelect, type SelectProps} from '@sentry/scraps/compactSelect';

import {figmaNodeUrl} from './utils';

figma.connect(CompactSelect, figmaNodeUrl('6538-1411'), {
  props: {
    size: figma.enum('Size', {
      MD: 'md',
      SM: 'sm',
      XS: 'xs',
      // Zero exists in Figma but not commonly used in CompactSelect
    }),
    // Figma has 'priority' (Default, Primary, Warning, Danger, Transparent)
    // but CompactSelect in React doesn't have a priority prop
    // Figma has 'leadingItem' (None, Icon, Text) for visual variants
    // CompactSelect uses triggerLabel and triggerProps for customization
    // No matching props could be found for these Figma properties:
    // priority: Not a prop in CompactSelect (uses button styles internally)
    // leadingItem: Handled via custom trigger or option rendering
    // state: Hover/Active/Focused/Disabled handled by CSS and disabled prop
    disabled: figma.boolean('Disabled'),
    // Core CompactSelect props not in Figma:
    // options: Array<SelectOptionOrSection<Value>> (data structure)
    // value: Value | Value[] (selected value)
    // onChange: (value) => void (callback)
    // multiple: boolean (selection mode)
    // clearable: boolean (show clear button)
    // searchable: boolean (show search input)
    // emptyMessage: ReactNode (no results message)
    // menuTitle, menuBody, menuFooter: Advanced customization
    // triggerProps: Custom trigger button props
  } satisfies Partial<SelectProps<string>>,
  example: props => (
    <CompactSelect
      size={props.size}
      disabled={props.disabled}
      options={[
        {label: 'Option 1', value: '1'},
        {label: 'Option 2', value: '2'},
      ]}
      value="1"
      onChange={() => {}}
    />
  ),
  links: [
    {
      name: 'Storybook',
      url: 'https://sentry.sentry.io/stories/core/compactselect',
    },
  ],
});
