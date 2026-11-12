import type {Tag} from 'sentry/types/group';
import {FieldKind, prettifyTagKey, type FieldDefinition} from 'sentry/utils/fields';

export function getKeyLabel(
  tag: Tag,
  fieldDefinition: FieldDefinition | null,
  {includeAggregateArgs = false} = {}
) {
  if (fieldDefinition?.kind === FieldKind.FUNCTION) {
    if (fieldDefinition.parameters?.length) {
      if (includeAggregateArgs) {
        return `${tag.key}(${fieldDefinition.parameters.map(p => p.name).join(', ')})`;
      }
      return `${tag.key}(...)`;
    }
    return `${tag.key}()`;
  }

  // Some columns in explore can be formatted as an explicity number tag.
  // We want to strip the explicit tag syntax before displaying where possible.
  return prettifyTagKey(tag.key);
}
