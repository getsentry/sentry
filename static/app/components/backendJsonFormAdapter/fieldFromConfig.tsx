import type {JsonFormAdapterFieldConfig} from './types';
import {transformChoices} from './utils';

/**
 * Subset of `JsonFormAdapterFieldConfig` rendered by `BackendJsonFieldFromConfig`.
 * Composite fields (`table`, `project_mapper`, `choice_mapper`) and `blank` are
 * handled inline by each form because their layout differs from the simple
 * "label + control" pattern. Async select is also handled inline because its
 * data-fetching wrapper only exists in `BackendJsonSubmitForm`.
 */
type SimpleField = Extract<
  JsonFormAdapterFieldConfig,
  {
    type:
      | 'boolean'
      | 'string'
      | 'text'
      | 'textarea'
      | 'url'
      | 'email'
      | 'secret'
      | 'number'
      | 'select'
      | 'choice';
  }
>;

/**
 * Minimal shape of the field-API used by this renderer. Both `AutoSaveForm`
 * and `useScrapsForm` + `AppField` provide these components, with slightly
 * different generic parameters that we erase to `unknown` here so a single
 * renderer can serve both call sites.
 */
interface FieldKit {
  Input: React.ComponentType<{
    onChange: (value: string) => void;
    type: 'text' | 'url' | 'email';
    value: string;
    disabled?: boolean;
    placeholder?: string;
  }>;
  Number: React.ComponentType<{
    onChange: (value: number) => void;
    value: number;
    disabled?: boolean;
    placeholder?: string;
  }>;
  Password: React.ComponentType<{
    onChange: (value: string) => void;
    value: string;
    disabled?: boolean;
    placeholder?: string;
  }>;
  Select: React.ComponentType<{
    onChange: (value: any) => void;
    options: Array<{label: string; value: string}>;
    value: any;
    disabled?: boolean;
  }>;
  Switch: React.ComponentType<{
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
  }>;
  TextArea: React.ComponentType<{
    onChange: (value: string) => void;
    value: string;
    autosize?: boolean;
    disabled?: boolean;
    placeholder?: string;
  }>;
}

interface BackendJsonFieldFromConfigProps {
  field: SimpleField;
  fieldApi: FieldKit;
  onChange: (value: any) => void;
  value: unknown;
  /**
   * Render `<TextArea>` with `autosize`. `BackendJsonSubmitForm` opts in;
   * `BackendJsonAutoSaveForm` does not.
   */
  autosizeTextarea?: boolean;
}

/**
 * Renders the input control for a backend-driven JSON form field.
 *
 * Returns only the control (no label/hint wrapper) so each form can choose
 * its own layout — `Layout.Row` for auto-save, `Layout.Stack` with `required`
 * for submit forms.
 */
export function BackendJsonFieldFromConfig({
  field,
  fieldApi,
  value,
  onChange,
  autosizeTextarea,
}: BackendJsonFieldFromConfigProps) {
  switch (field.type) {
    case 'boolean':
      return (
        <fieldApi.Switch
          checked={Boolean(value)}
          onChange={onChange}
          disabled={field.disabled}
        />
      );
    case 'textarea':
      return (
        <fieldApi.TextArea
          autosize={autosizeTextarea}
          value={(value as string) ?? ''}
          onChange={onChange}
          placeholder={field.placeholder}
          disabled={field.disabled}
        />
      );
    case 'number':
      return (
        <fieldApi.Number
          value={value as number}
          onChange={onChange}
          placeholder={field.placeholder}
          disabled={field.disabled}
        />
      );
    case 'secret':
      return (
        <fieldApi.Password
          value={(value as string) ?? ''}
          onChange={onChange}
          placeholder={field.placeholder}
          disabled={field.disabled}
        />
      );
    case 'string':
    case 'text':
    case 'url':
    case 'email':
      return (
        <fieldApi.Input
          type={field.type === 'string' || field.type === 'text' ? 'text' : field.type}
          value={(value as string) ?? ''}
          onChange={onChange}
          placeholder={field.placeholder}
          disabled={field.disabled}
        />
      );
    case 'select':
    case 'choice':
      return (
        <fieldApi.Select
          value={value}
          onChange={onChange}
          options={transformChoices(field.choices)}
          disabled={field.disabled}
        />
      );
    default:
      return null;
  }
}
