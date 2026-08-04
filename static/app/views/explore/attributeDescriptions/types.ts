export type TraceItemDatasetValue =
  | 'spans'
  | 'logs'
  | 'tracemetrics'
  | 'preprod'
  | 'processing_errors';

export type AttributeTypeValue = 'string' | 'number' | 'boolean';

export function isAttributeTypeValue(value: string): value is AttributeTypeValue {
  return value === 'string' || value === 'number' || value === 'boolean';
}

export interface TraceItemAttributeContext {
  brief?: string;
  // Longer-form notes; the authoring endpoint stores a single string, which the
  // list endpoint normalizes to a one-element list.
  details?: string[];
  examples?: string[];
  // A Sentry-owned convention (not editable).
  isConvention?: boolean;
  // Marks a user-authored context row (editable).
  isCustom?: boolean;
  isDeprecated?: boolean;
  replacementAttribute?: string;
}

/**
 * A single row from the trace item attributes list endpoint
 * (`GET /organizations/{org}/trace-items/attributes/`).
 */
export interface TraceItemAttributeListItem {
  attributeSource: {
    source_type: 'sentry' | 'user';
    is_transformed_alias?: boolean;
  };
  attributeType: AttributeTypeValue;
  // The public alias used to query the attribute.
  key: string;
  // The display name for the attribute.
  name: string;
  // Only present when `expand=context` is requested.
  context?: TraceItemAttributeContext;
  secondaryAliases?: string[];
}

/**
 * Whether an attribute can have user-authored context written to it. The
 * context endpoint rejects Sentry-owned (reserved) attributes.
 */
export function isEditableAttribute(attribute: TraceItemAttributeListItem): boolean {
  return attribute.attributeSource.source_type === 'user';
}
