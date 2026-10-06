import {InfoText} from '@sentry/scraps/info';
import {Text} from '@sentry/scraps/text';

import {AttributeDetails} from 'sentry/components/attributes/attributeDetails';
import {
  DEFAULT_TAG_DESCRIPTION,
  FieldValueType,
  getFieldDefinition,
  type GetFieldDefinitionType,
} from 'sentry/utils/fields';
import {getAttributeVisibility} from 'sentry/utils/fields/getAttributeVisibility';
import {useUser} from 'sentry/utils/useUser';

export interface AttributeDetailsTooltipProps {
  /**
   * The attribute's canonical key, as the field definition registry names it.
   */
  attributeKey: string;
  /**
   * The registry `attributeKey` is looked up in. An attribute found there is one
   * Sentry defines, so the tooltip credits Sentry for it.
   */
  fieldDefinitionType: GetFieldDefinitionType;
  /**
   * The text rendered inline, when only part of the name belongs there, e.g. one
   * segment of a key the surrounding table already nests.
   */
  children?: React.ReactNode;
  /**
   * The type shown when no field definition supplies one. A definition types an
   * attribute more precisely than its storage does, so it is never overridden.
   */
  defaultValueType?: FieldValueType;
  isScrubbed?: boolean;
  /**
   * What the attribute is called, when that reads better than its canonical key,
   * e.g. with a `sentry.` prefix or a `tags[…]` wrapper taken off.
   */
  name?: string;
}

/**
 * Renders an attribute's name as the hover target for its details, so the
 * underline marks the name as something to hover rather than just text.
 */
export function AttributeDetailsTooltip({
  attributeKey,
  defaultValueType,
  fieldDefinitionType,
  children,
  isScrubbed,
  name,
}: AttributeDetailsTooltipProps) {
  const user = useUser();
  const fieldDefinition =
    getFieldDefinition(attributeKey, fieldDefinitionType) ??
    (name === undefined ? null : getFieldDefinition(name, fieldDefinitionType));
  const attributeName = name ?? attributeKey;

  return (
    <InfoText
      monospace
      variant="muted"
      title={
        <AttributeDetails
          description={fieldDefinition?.desc ?? DEFAULT_TAG_DESCRIPTION}
          isAddedBySentry={Boolean(fieldDefinition)}
          isInternal={
            user.isStaff &&
            getAttributeVisibility(attributeKey, attributeName) === 'internal'
          }
          isScrubbed={isScrubbed}
          name={
            <Text bold monospace wordBreak="break-word">
              {attributeName}
            </Text>
          }
          valueType={
            fieldDefinition?.valueType ?? defaultValueType ?? FieldValueType.STRING
          }
        />
      }
    >
      {children ?? attributeName}
    </InfoText>
  );
}
