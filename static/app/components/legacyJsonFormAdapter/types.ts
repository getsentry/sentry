/**
 * Field configuration returned by the backend's `get_organization_config()`.
 * All values are JSON-serializable — no functions, no React nodes.
 */
interface JsonFormAdapterBase {
  label: string;
  name: string;
  type: string;
  default?: unknown;
  disabled?: boolean;
  disabledReason?: string;
  help?: string;
  placeholder?: string;
  required?: boolean;
}

interface JsonFormAdapterBoolean extends JsonFormAdapterBase {
  type: 'boolean';
  default?: boolean;
}

interface JsonFormAdapterString extends JsonFormAdapterBase {
  type: 'string' | 'text' | 'textarea' | 'url' | 'email';
}

interface JsonFormAdapterSecret extends JsonFormAdapterBase {
  type: 'secret';
  formatMessageValue?: boolean;
}

interface JsonFormAdapterSelect extends JsonFormAdapterBase {
  type: 'select' | 'choice';
  choices?: Array<[value: string, label: string]>;
}

interface JsonFormAdapterNumber extends JsonFormAdapterBase {
  type: 'number';
  default?: number;
}

interface JsonFormAdapterChoiceMapper extends JsonFormAdapterBase {
  type: 'choice_mapper';
  addButtonText?: string;
  addDropdown?: Record<string, unknown>;
  columnLabels?: Record<string, string>;
  formatMessageValue?: boolean;
  mappedColumnLabel?: string;
  mappedSelectors?: Record<
    string,
    {choices: Array<[string, string]>; placeholder?: string}
  >;
}

interface JsonFormAdapterTable extends JsonFormAdapterBase {
  type: 'table';
  addButtonText?: string;
  columnKeys?: string[];
  columnLabels?: Record<string, string>;
  confirmDeleteMessage?: string;
}

interface JsonFormAdapterProjectMapper extends JsonFormAdapterBase {
  type: 'project_mapper';
  iconType?: string;
  mappedDropdown?: {
    items: Array<{label: string; value: string; url?: string}>;
    placeholder?: string;
  };
  nextButton?: {allowedDomain: string; description: string; text: string};
  sentryProjects?: Array<{
    id: number;
    name: string;
    platform: string | null;
    slug: string;
  }>;
}

export type JsonFormAdapterFieldConfig =
  | JsonFormAdapterBoolean
  | JsonFormAdapterString
  | JsonFormAdapterSecret
  | JsonFormAdapterSelect
  | JsonFormAdapterNumber
  | JsonFormAdapterChoiceMapper
  | JsonFormAdapterTable
  | JsonFormAdapterProjectMapper;
