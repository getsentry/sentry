import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t} from 'sentry/locale';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import {
  BufferedInput,
  type ParameterDescription,
} from 'sentry/views/discover/table/queryField';

export function AggregateParameterField({
  parameter,
  fieldValue,
  onChange,
  currentValue,
}: {
  currentValue: string;
  fieldValue: QueryFieldValue;
  onChange: (value: string) => void;
  parameter: ParameterDescription;
}) {
  if (parameter.kind === 'value') {
    const inputProps = {
      required: parameter.required,
      value:
        currentValue ?? ('defaultValue' in parameter && parameter?.defaultValue) ?? '',
      onUpdate: (value: any) => {
        onChange(value);
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          onChange(e.currentTarget.value);
        }
      },
      placeholder: parameter.placeholder,
    };
    switch (parameter.dataType) {
      case 'number':
        return (
          <BufferedInput
            name="refinement"
            key={`parameter:number-${currentValue}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*(\.[0-9]*)?"
            aria-label={t('Numeric Input')}
            {...inputProps}
          />
        );
      case 'integer':
        return (
          <BufferedInput
            name="refinement"
            key="parameter:integer"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={t('Integer Input')}
            {...inputProps}
          />
        );
      default:
        return (
          <BufferedInput
            name="refinement"
            key="parameter:text"
            type="text"
            aria-label={t('Text Input')}
            {...inputProps}
          />
        );
    }
  }
  if (parameter.kind === 'dropdown') {
    return (
      <SelectControl
        key="dropdown"
        name="dropdown"
        menuPlacement="auto"
        placeholder={t('Select value')}
        options={parameter.options}
        value={currentValue}
        required={parameter.required}
        onChange={({value}: any) => {
          onChange(value);
        }}
        searchable
      />
    );
  }
  throw new Error(`Unknown parameter type encountered for ${fieldValue}`);
}
