import {useCallback, useMemo} from 'react';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import type {DropdownButtonProps} from 'sentry/components/dropdownButton';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';

const CompactSelectTriggerProps: DropdownButtonProps = {
  icon: <IconSettings />,
  showChevron: false,
  size: 'xs' as const,
  'aria-label': t('Trace Preferences'),
};

interface TracePreferencesDropdownProps {
  autogroup: boolean;
  missingInstrumentation: boolean;
  onAutogroupChange: () => void;
  onMissingInstrumentationChange: () => void;
}

const TRACE_PREFERENCES_DROPDOWN_OPTIONS: SelectOption<string>[] = [
  {
    label: t('Autogrouping'),
    value: 'autogroup',
    details: t(
      'Collapses 5 or more sibling spans with the same description or any spans with 2 or more descendants with the same operation.'
    ),
  },
  {
    label: t('No Instrumentation'),
    value: 'no-instrumentation',
    details: t(
      'Shows when there is more than 100ms of unaccounted elapsed time between two spans.'
    ),
  },
];

export function TracePreferencesDropdown(props: TracePreferencesDropdownProps) {
  const values = useMemo(() => {
    const value: string[] = [];
    if (props.autogroup) {
      value.push('autogroup');
    }
    if (props.missingInstrumentation) {
      value.push('no-instrumentation');
    }
    return value;
  }, [props.autogroup, props.missingInstrumentation]);

  const onAutogroupChange = props.onAutogroupChange;
  const onMissingInstrumentationChange = props.onMissingInstrumentationChange;

  const onChange = useCallback(
    (newValues: SelectOption<string>[]) => {
      const newValuesArray = newValues.map(v => v.value);

      if (values.length < newValuesArray.length) {
        const newOption = newValuesArray.find(v => !values.includes(v));
        if (newOption === 'autogroup') {
          onAutogroupChange();
        }
        if (newOption === 'no-instrumentation') {
          onMissingInstrumentationChange();
        }
      }

      if (values.length > newValuesArray.length) {
        const removedOption = values.find(v => !newValuesArray.includes(v));
        if (removedOption === 'autogroup') {
          onAutogroupChange();
        }
        if (removedOption === 'no-instrumentation') {
          onMissingInstrumentationChange();
        }
      }
    },
    [values, onAutogroupChange, onMissingInstrumentationChange]
  );

  return (
    <CompactSelect
      multiple
      value={values}
      // Force the trigger to be so that we only render the icon
      triggerLabel=""
      triggerProps={CompactSelectTriggerProps}
      options={TRACE_PREFERENCES_DROPDOWN_OPTIONS}
      onChange={onChange}
      menuWidth={300}
    />
  );
}
