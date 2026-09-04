export enum FieldKind {
  TAG = 'tag',
  FEATURE_FLAG = 'feature_flag',
  MEASUREMENT = 'measurement',
  BREAKDOWN = 'breakdown',
  FIELD = 'field',
  ISSUE_FIELD = 'issue_field',
  EVENT_FIELD = 'event_field',
  FUNCTION = 'function',
  EQUATION = 'equation',
  METRICS = 'metric',
  NUMERIC_METRICS = 'numeric_metric',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
}

export enum FieldValueType {
  BOOLEAN = 'boolean',
  DATE = 'date',
  DURATION = 'duration',
  INTEGER = 'integer',
  NUMBER = 'number',
  PERCENTAGE = 'percentage',
  STRING = 'string',
  NEVER = 'never',
  SIZE = 'size',
  RATE = 'rate',
  PERCENT_CHANGE = 'percent_change',
  SCORE = 'score',
  CURRENCY = 'currency',
  ARRAY = 'array',
}

type AggregateColumnParameter = {
  /**
   * The types of columns that are valid for this parameter.
   * Can pass a list of FieldValueTypes or a predicate function.
   */
  columnTypes:
    | FieldValueType[]
    | ((field: {key: string; valueType: FieldValueType}) => boolean);
  kind: 'column';
  name: string;
  required: boolean;
  defaultLabel?: string;
  defaultValue?: string;
};

type AggregateValueParameter = {
  dataType: FieldValueType;
  kind: 'value';
  name: string;
  required: boolean;
  defaultValue?: string;
  options?: Array<{value: string; label?: string}>;
  placeholder?: string;
};

export type AggregateParameter = AggregateColumnParameter | AggregateValueParameter;

type ParameterDependentValueType = (parameters: Array<string | null>) => FieldValueType;

export interface FieldDefinition {
  kind: FieldKind;
  valueType: FieldValueType | null;
  /**
   * Allow all comparison operators to be used with this field.
   * Useful for fields like `release.version` which accepts text, but
   * can also be used with operators like `>=` or `<`.
   */
  allowComparisonOperators?: boolean;
  /**
   * Allow multiple values to be selected for this field.
   * This is only valid for string and default numeric filters and defaults to true.
   */
  allowMultipleValues?: boolean;
  /**
   * Allow wildcard (*) matching for this field.
   * This is only valid for string fields and will default to true.
   * Note that the `disallowWildcardOperators` setting will override this.
   */
  allowWildcard?: boolean;
  /**
   * Default value for the field
   */
  defaultValue?: string;
  /**
   * Is this field being deprecated
   */
  deprecated?: boolean;
  /**
   * Description of the field
   */
  desc?: string;
  /**
   * Disallow wildcard (contains, starts with, ends with) operators for this field
   * This is only valid for string fields and will default to false.
   * Setting this to true will override `allowWildcard`.
   */
  disallowWildcardOperators?: boolean;
  /**
   * Feature flag that indicates gating of the field from use
   */
  featureFlag?: string;
  /**
   * Additional keywords used when filtering via autocomplete
   */
  keywords?: string[];
  /**
   * Only valid for aggregate fields.
   * Modifies the value type based on the parameters passed to the function.
   */
  parameterDependentValueType?: ParameterDependentValueType;
  /**
   * Only valid for aggregate fields.
   * Defines the number and type of parameters that the function accepts.
   */
  parameters?: AggregateParameter[];
  /**
   * Potential values for the field
   */
  values?: string[];
}
