import styled from '@emotion/styled';

import {DescriptionList} from '@sentry/scraps/descriptionList';

import {useSearchQueryBuilderConfig} from 'sentry/components/searchQueryBuilder/context';
import {getKeyLabel} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/utils';
import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types/group';
import {FieldKind, FieldValueType, type FieldDefinition} from 'sentry/utils/fields';
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
  const {getFieldDefinition} = useSearchQueryBuilderConfig();

  const fieldDefinition = getFieldDefinition(tag.key);

  const description =
    fieldDefinition?.desc ??
    (tag.kind === FieldKind.TAG
      ? t('A tag sent with one or more events')
      : tag.kind === FieldKind.FEATURE_FLAG
        ? t('A feature flag evaluated before an error event')
        : null);

  return (
    <DescriptionWrapper size={size}>
      <DescriptionKeyLabel>
        {getKeyLabel(tag, fieldDefinition, {includeAggregateArgs: true})}
      </DescriptionKeyLabel>
      {description ? <p>{description}</p> : null}
      <Separator />
      <DescriptionList gap="xs">
        <DescriptionList.Term>{t('Type')}</DescriptionList.Term>
        <DescriptionList.Details>
          <ValueType fieldDefinition={fieldDefinition} fieldKind={tag.kind} />
        </DescriptionList.Details>
      </DescriptionList>
    </DescriptionWrapper>
  );
}

const DescriptionWrapper = styled('div')<Pick<KeyDescriptionProps, 'size'>>`
  padding: ${p =>
    p.size === 'sm'
      ? `${p.theme.space.sm} ${p.theme.space.md}`
      : `${p.theme.space.lg} ${p.theme.space.xl}`};
  max-width: ${p => (p.size === 'sm' ? '220px' : 'none')};
  font-size: ${p => (p.size === 'sm' ? p.theme.font.size.sm : p.theme.font.size.md)};

  p {
    margin: 0;
  }

  p + p {
    margin-top: ${p => p.theme.space.xs};
  }
`;

const DescriptionKeyLabel = styled('p')`
  font-weight: ${p => p.theme.font.weight.sans.medium};
  word-break: break-all;
`;

const Separator = styled('hr')`
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  margin: ${p => p.theme.space.md} 0;
`;
