import Checkbox from 'sentry/components/checkbox';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';

interface TracePreferencesDropdownProps {
  autogroup: boolean;
  missingInstrumentation: boolean;
  onAutogroupChange: () => void;
  onMissingInstrumentationChange: () => void;
}

export function TracePreferencesDropdown(props: TracePreferencesDropdownProps) {
  return (
    <DropdownMenu
      closeOnSelect={false}
      triggerProps={{
        'aria-label': t('Trace Preferences'),
        icon: <IconSettings />,
        showChevron: false,
        size: 'xs',
      }}
      items={[
        {
          key: 'autogroup',
          label: t('Autogrouping'),
          submenuTitle: t('Autogrouping'),
          onAction: props.onAutogroupChange,
          leadingItems: [<Checkbox key="autogroup" checked={props.autogroup} />],
        },
        {
          key: 'missing-instrumentation',
          label: t('Missing Instrumentation'),
          submenuTitle: t('Missing Instrumentation'),
          onAction: props.onMissingInstrumentationChange,
          leadingItems: [
            <Checkbox
              key="missing-instrumentation"
              checked={props.missingInstrumentation}
            />,
          ],
        },
      ]}
    />
  );
}
