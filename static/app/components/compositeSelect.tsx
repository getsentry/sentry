import {useMemo, useState} from 'react';

import CompactSelect from 'sentry/components/compactSelect';
import {GeneralSelectValue} from 'sentry/components/forms/controls/selectControl';
import {valueIsEqual} from 'sentry/utils';

/**
 * CompositeSelect simulates independent selectors inside the same dropdown
 * menu. Each selector is called a "section". The selection value of one
 * section does not affect the value of the others.
 */
type Section<OptionType> = {
  /**
   * Text label that will be display on top of the section.
   */
  label: string;
  /**
   * Selectable options inside the section.
   */
  options: OptionType[];
  /**
   * Must be a unique identifying key for the section. This value will be
   * used in the onChange return value. For example, if there are two
   * sections, "section1" and "section2", then the onChange callback will be
   * invoked as onChange({section1: [selected option values], section2:
   * [selected option values]}).
   */
  value: string;
  defaultValue?: any;
  /**
   * Whether the section has multiple (versus) single selection.
   */
  multiple?: boolean;
  onChange?: (value: any) => void;
};

type ExtendedOptionType = GeneralSelectValue & {
  selectionMode?: 'multiple' | 'single';
};

type Props<OptionType> = Omit<
  React.ComponentProps<typeof CompactSelect>,
  'multiple' | 'defaultValue' | 'onChange'
> & {
  /**
   * Array containing the independent selection sections. NOTE: This array
   * should not change (i.e. we shouldn't add/remove sections) during the
   * component's lifecycle. Updating the options array inside sech section is
   * fine.
   */
  sections: Section<OptionType>[];
};

/**
 * Special version of CompactSelect that simulates independent selectors (here
 * implemented as "sections") within the same dropdown menu.
 */
function CompositeSelect<OptionType extends GeneralSelectValue = GeneralSelectValue>({
  sections,
  ...props
}: Props<OptionType>) {
  const [values, setValues] = useState(sections.map(section => section.defaultValue));

  /**
   * Object that maps an option value (e.g. "opt_one") to its parent section's index,
   * to be used in onChangeValueMap.
   */
  const optionsMap = useMemo(() => {
    const allOptions = sections
      .map((section, i) => section.options.map(opt => [opt.value, i]))
      .flat();
    return Object.fromEntries(allOptions);
  }, [sections]);

  /**
   * Options with the "selectionMode" key attached. This key overrides the
   * isMulti setting from SelectControl and forces SelectOption
   * (./selectOption.tsx) to display either a chekmark or a checkbox based on
   * the selection mode of its parent section, rather than the selection mode
   * of the entire select menu.
   */
  const options = useMemo(() => {
    return sections.map(section => ({
      ...section,
      options: section.options.map(
        opt =>
          ({
            ...opt,
            selectionMode: section.multiple ? 'multiple' : 'single',
          } as ExtendedOptionType)
      ),
    }));
  }, [sections]);

  /**
   * Intercepts the incoming set of selected values, and trims it so that
   * single-selection sections will only have one selected value at a time.
   */
  function onChangeValueMap(selectedOptions: ExtendedOptionType[]) {
    const newValues = new Array(sections.length).fill(undefined);

    selectedOptions.forEach(option => {
      const parentSectionIndex = optionsMap[option.value];
      const parentSection = sections[parentSectionIndex];

      // If the section allows multiple selection, then add the value to the
      // list of selected values
      if (parentSection.multiple) {
        if (!newValues[parentSectionIndex]) {
          newValues[parentSectionIndex] = [];
        }
        newValues[parentSectionIndex].push(option.value);
        return;
      }

      // If the section allows only single selection, then replace whatever the
      // old value is with the new one.
      if (option.value) {
        newValues[parentSectionIndex] = option.value;
      }
    });

    sections.forEach((section, i) => {
      // Prevent sections with single selection from losing their values. This might
      // happen if the user clicks on an already-selected option.
      if (!section.multiple && !newValues[i]) {
        newValues[i] = values[i];
        // Return an empty array for sections with multiple selection without any value.
      } else if (!newValues[i]) {
        newValues[i] = [];
      }

      // Trigger the onChange callback for sections whose values have changed.
      if (!valueIsEqual(values[i], newValues[i])) {
        sections[i].onChange?.(newValues[i]);
      }
    });

    setValues(newValues);

    // Return a flattened array of the selected values to be used inside
    // CompactSelect and SelectControl.
    return newValues.flat();
  }

  return (
    <CompactSelect
      {...props}
      multiple
      options={options}
      defaultValue={sections.map(section => section.defaultValue).flat()}
      onChangeValueMap={onChangeValueMap}
    />
  );
}

export default CompositeSelect;
