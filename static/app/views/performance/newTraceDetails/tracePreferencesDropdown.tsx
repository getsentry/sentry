import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';

interface TracePreferencesDropdownProps {
  onAutogroupChange: () => void;
  onMissingInstrumentationChange: () => void;
}

export function TracePreferencesDropdown(props: TracePreferencesDropdownProps) {
  return (
    <DropdownMenu
      triggerProps={{
        'aria-label': t('Trace Preferences'),
        icon: <IconSettings />,
        showChevron: false,
        size: 'xs',
      }}
      items={[
        {
          key: 'autogroup',
          label: t('Autogroup'),
          onAction: props.onAutogroupChange,
        },
        {
          key: 'missing-instrumentation',
          label: t('Missing Instrumentation'),
          onAction: props.onMissingInstrumentationChange,
        },
      ]}
    />
  );
}
