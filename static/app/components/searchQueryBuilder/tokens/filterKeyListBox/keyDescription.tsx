import styled from '@emotion/styled';

import {AttributeDetails} from 'sentry/components/attributes/attributeDetails';
import {useSearchQueryBuilderConfig} from 'sentry/components/searchQueryBuilder/context';
import {getKeyLabel} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/utils';
import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types/group';
import {
  DEFAULT_ATTRIBUTE_DESCRIPTION,
  DEFAULT_TAG_DESCRIPTION,
  FieldKind,
  FieldValueType,
  type FieldDefinition,
} from 'sentry/utils/fields';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

const SENTRY_DEFINED_KINDS = new Set<FieldKind | undefined>([
  FieldKind.BREAKDOWN,
  FieldKind.EQUATION,
  FieldKind.EVENT_FIELD,
  FieldKind.FIELD,
  FieldKind.FUNCTION,
  FieldKind.ISSUE_FIELD,
]);

type KeyDescriptionProps = {
  tag: Tag;
  size?: 'sm' | 'md';
};

export function ValueType({
  fieldDefinition,
  fieldKind,
}: {
  fieldDefinition: FieldDefinition | null;
  fieldKind?: FieldKind;
}) {
  const defaultType =
    fieldKind === FieldKind.FEATURE_FLAG ? FieldValueType.BOOLEAN : FieldValueType.STRING;

  if (fieldKind === FieldKind.ARRAY) {
    return toTitleCase(FieldValueType.ARRAY);
  }

  if (!fieldDefinition) {
    return toTitleCase(defaultType);
  }

  if (fieldDefinition.parameterDependentValueType) {
    return t('Dynamic');
  }

  return toTitleCase(fieldDefinition?.valueType ?? defaultType);
}

export function KeyDescription({size = 'sm', tag}: KeyDescriptionProps) {
  const {getFieldDefinition} = useSearchQueryBuilderConfig();

  const fieldDefinition = getFieldDefinition(tag.key);

  const sentryDescription = fieldDefinition?.desc;

  const description = sentryDescription ?? getFallbackDescription(tag, fieldDefinition);

  const defaultValueType =
    tag.kind === FieldKind.FEATURE_FLAG ? FieldValueType.BOOLEAN : FieldValueType.STRING;

  return (
    <DescriptionWrapper size={size}>
      <AttributeDetails
        description={description}
        isAddedBySentry={Boolean(sentryDescription)}
        kind={fieldDefinition?.kind ?? tag.kind}
        name={getKeyLabel(tag, fieldDefinition, {includeAggregateArgs: true})}
        valueType={fieldDefinition?.valueType ?? defaultValueType}
      />
    </DescriptionWrapper>
  );
}

function getFallbackDescription(tag: Tag, fieldDefinition: FieldDefinition | null) {
  if (tag.attributeSource === 'sentry') {
    return null;
  }

  if (tag.kind === FieldKind.FEATURE_FLAG) {
    return t('A feature flag evaluated before an error event');
  }

  if (tag.kind === FieldKind.TAG) {
    return DEFAULT_TAG_DESCRIPTION;
  }

  // Only trace items carry an attributeSource, and their getters synthesize
  // definitions for user attributes. Elsewhere, a registered definition or a
  // Sentry-only kind marks the key as Sentry's, while custom tags (e.g. from
  // tagStore) arrive with neither.
  if (!tag.attributeSource && (fieldDefinition || SENTRY_DEFINED_KINDS.has(tag.kind))) {
    return null;
  }

  return DEFAULT_ATTRIBUTE_DESCRIPTION;
}

const DescriptionWrapper = styled('div')<Pick<KeyDescriptionProps, 'size'>>`
  max-width: ${p => (p.size === 'sm' ? '220px' : 'none')};
  font-size: ${p => (p.size === 'sm' ? p.theme.font.size.sm : p.theme.font.size.md)};
`;
