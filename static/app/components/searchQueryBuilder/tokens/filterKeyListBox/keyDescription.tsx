import styled from '@emotion/styled';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {getKeyLabel} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag} from 'sentry/types/group';
import {type FieldDefinition, FieldKind, FieldValueType} from 'sentry/utils/fields';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

type KeyDescriptionProps = {
  tag: Tag;
  size?: 'sm' | 'md';
};

function ValueType({
  fieldDefinition,
  fieldKind,
}: {
  fieldDefinition: FieldDefinition | null;
  fieldKind?: FieldKind;
}) {
  const defaultType =
    fieldKind === FieldKind.FEATURE_FLAG ? FieldValueType.BOOLEAN : FieldValueType.STRING;
  if (!fieldDefinition) {
    return toTitleCase(defaultType);
  }

  if (fieldDefinition.parameterDependentValueType) {
    return t('Dynamic');
  }

  return toTitleCase(fieldDefinition?.valueType ?? defaultType);
}

export function KeyDescription({size = 'sm', tag}: KeyDescriptionProps) {
  const {getFieldDefinition} = useSearchQueryBuilder();

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
      <DescriptionList>
        <Term>{t('Type')}</Term>
        <Details>
          <ValueType fieldDefinition={fieldDefinition} fieldKind={tag.kind} />
        </Details>
      </DescriptionList>
    </DescriptionWrapper>
  );
}

const DescriptionWrapper = styled('div')<Pick<KeyDescriptionProps, 'size'>>`
  padding: ${p =>
    p.size === 'sm' ? `${space(0.75)} ${space(1)}` : `${space(1.5)} ${space(2)}`};
  max-width: ${p => (p.size === 'sm' ? '220px' : 'none')};
  font-size: ${p => (p.size === 'sm' ? p.theme.fontSizeSmall : p.theme.fontSizeMedium)};

  p {
    margin: 0;
  }

  p + p {
    margin-top: ${space(0.5)};
  }
`;

const DescriptionKeyLabel = styled('p')`
  font-weight: ${p => p.theme.fontWeightBold};
  word-break: break-all;
`;

const Separator = styled('hr')`
  border-top: 1px solid ${p => p.theme.border};
  margin: ${space(1)} 0;
`;

const DescriptionList = styled('dl')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(0.5)};
  margin: 0;
`;

const Term = styled('dt')`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const Details = styled('dd')``;
