import {withFieldGroup} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {EditableText} from 'sentry/components/editableText';
import {FormField} from 'sentry/components/forms/formField';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';

/**
 * Legacy version for forms using FormModel/FormContext.
 * Remove once all detector forms have migrated to the new form system.
 */
export function EditableDetectorNameDeprecated() {
  return (
    <FormField name="name" inline={false} flexibleControlStateSize stacked>
      {({onChange, value}) => (
        <EditableDetectorNameTextField
          value={value || ''}
          onChange={newValue => {
            onChange(newValue, {target: {value: newValue}});
          }}
        />
      )}
    </FormField>
  );
}

export const EditableDetectorName = withFieldGroup({
  defaultValues: {name: ''},
  props: {},
  render: ({group}) => (
    <group.AppField name="name">
      {field => {
        const errorMessage = field.state.meta.isValid
          ? undefined
          : field.state.meta.errors
              .map(e => e?.message)
              .filter(Boolean)
              .join(', ');
        return (
          <Flex gap="sm" align="center">
            <EditableDetectorNameTextField
              value={field.state.value}
              onChange={field.handleChange}
            />
            {errorMessage ? (
              <Tooltip position="bottom" title={errorMessage} forceVisible skipWrapper>
                <IconWarning color="danger" size="sm" />
              </Tooltip>
            ) : null}
          </Flex>
        );
      }}
    </group.AppField>
  ),
});

function EditableDetectorNameTextField({
  value,
  onChange,
}: {
  onChange: (newValue: string) => void;
  value: string;
}) {
  const {setHasSetDetectorName} = useDetectorFormContext();

  return (
    <EditableText
      allowEmpty
      value={value || ''}
      onChange={newValue => {
        onChange(newValue);
        setHasSetDetectorName(true);
      }}
      placeholder={t('New Monitor')}
      aria-label={t('Monitor Name')}
      variant="compact"
    />
  );
}
