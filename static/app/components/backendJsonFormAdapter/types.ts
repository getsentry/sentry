import type {PlatformKey} from 'sentry/types/project';

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
  /**
   * When true, changing this field triggers a re-fetch of the form config
   * from the backend with the new value as a query parameter.
   * Used by BackendJsonSubmitForm to support dynamic form fields.
   */
  updatesForm?: boolean;
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
  /**
   * When true, allows selecting multiple values.
   */
  multiple?: boolean;
  /**
   * URL for async select fields. When set, options are fetched from this
   * endpoint as the user types instead of using static `choices`.
   */
  url?: string;
}

interface JsonFormAdapterNumber extends JsonFormAdapterBase {
  type: 'number';
  default?: number;
}

type ChoiceMapperSelector = {choices: Array<[string, string]>; placeholder?: string};

interface JsonFormAdapterChoiceMapperBase extends JsonFormAdapterBase {
  type: 'choice_mapper';
  addButtonText?: string;
  addDropdown?: {
    items: Array<{label: string; value: string}>;
    emptyMessage?: string;
    noResultsMessage?: string;
    searchField?: string;
    url?: string;
  };
  columnLabels?: Record<string, string>;
  formatMessageValue?: boolean;
  mappedColumnLabel?: string;
}

interface JsonFormAdapterChoiceMapperFlat extends JsonFormAdapterChoiceMapperBase {
  mappedSelectors?: Record<string, ChoiceMapperSelector>;
  perItemMapping?: false;
}

interface JsonFormAdapterChoiceMapperPerItem extends JsonFormAdapterChoiceMapperBase {
  perItemMapping: true;
  mappedSelectors?: Record<string, Record<string, ChoiceMapperSelector>>;
}

type JsonFormAdapterChoiceMapper =
  | JsonFormAdapterChoiceMapperFlat
  | JsonFormAdapterChoiceMapperPerItem;

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
    items: ReadonlyArray<{label: string; value: string; url?: string}>;
    placeholder?: string;
  };
  nextButton?: {allowedDomain: string; description: string; text: string};
  sentryProjects?: ReadonlyArray<{
    id: number;
    name: string;
    slug: string;
    platform?: PlatformKey;
  }>;
}

/**
 * A blank field is used to signal errors in the form config.
 * It renders nothing but can be detected to disable form submission.
 */
interface JsonFormAdapterBlank extends JsonFormAdapterBase {
  type: 'blank';
}

export type JsonFormAdapterFieldConfig =
  | JsonFormAdapterBoolean
  | JsonFormAdapterString
  | JsonFormAdapterSecret
  | JsonFormAdapterSelect
  | JsonFormAdapterNumber
  | JsonFormAdapterChoiceMapper
  | JsonFormAdapterTable
  | JsonFormAdapterProjectMapper
  | JsonFormAdapterBlank;

/**
 * Maps a field config type to the shape of its value.
 */
export type FieldValue<T extends JsonFormAdapterFieldConfig> =
  T extends JsonFormAdapterBoolean
    ? boolean
    : T extends JsonFormAdapterString | JsonFormAdapterSecret
      ? string
      : T extends JsonFormAdapterNumber
        ? number
        : T extends JsonFormAdapterSelect
          ? string | null
          : T extends JsonFormAdapterChoiceMapper
            ? Record<string, Record<string, unknown>>
            : T extends JsonFormAdapterTable
              ? Array<Record<string, unknown>>
              : T extends JsonFormAdapterProjectMapper
                ? Array<[number, string]>
                : T extends JsonFormAdapterBlank
                  ? never
                  : unknown;
