import styled from '@emotion/styled';

import {AttributeDetails} from 'sentry/components/attributes/attributeDetails';
import {useSearchQueryBuilderConfig} from 'sentry/components/searchQueryBuilder/context';
import {getKeyLabel} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/utils';
import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types/group';
import {
  DEFAULT_TAG_DESCRIPTION,
  FieldKind,
  FieldValueType,
  type FieldDefinition,
} from 'sentry/utils/fields';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

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
  return (
    <DescriptionWrapper size={size}>
      <KeyDetails tag={tag} />
    </DescriptionWrapper>
  );
}

export function KeyDetails({tag}: {tag: Tag}) {
  const {getFieldDefinition} = useSearchQueryBuilderConfig();

  const fieldDefinition = getFieldDefinition(tag.key);

  const sentryDescription = fieldDefinition?.desc;

  const description =
    sentryDescription ??
    (tag.kind === FieldKind.TAG
      ? DEFAULT_TAG_DESCRIPTION
      : tag.kind === FieldKind.FEATURE_FLAG
        ? t('A feature flag evaluated before an error event')
        : null);

  const defaultValueType =
    tag.kind === FieldKind.FEATURE_FLAG ? FieldValueType.BOOLEAN : FieldValueType.STRING;

  return (
    <AttributeDetails
      description={description}
      isAddedBySentry={Boolean(sentryDescription)}
      kind={fieldDefinition?.kind ?? tag.kind}
      name={getKeyLabel(tag, fieldDefinition, {includeAggregateArgs: true})}
      valueType={fieldDefinition?.valueType ?? defaultValueType}
    />
  );
}

const DescriptionWrapper = styled('div')<Pick<KeyDescriptionProps, 'size'>>`
  max-width: ${p => (p.size === 'sm' ? '220px' : 'none')};
  font-size: ${p => (p.size === 'sm' ? p.theme.font.size.sm : p.theme.font.size.md)};
`;
