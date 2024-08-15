import styled from '@emotion/styled';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {getKeyLabel} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag} from 'sentry/types/group';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

export function KeyDescription({tag}: {tag: Tag}) {
  const {getFieldDefinition} = useSearchQueryBuilder();

  const fieldDefinition = getFieldDefinition(tag.key);

  const description =
    fieldDefinition?.desc ??
    (tag.kind === FieldKind.TAG ? t('A tag sent with one or more events') : null);

  return (
    <DescriptionWrapper>
      <DescriptionKeyLabel>
        {getKeyLabel(tag, fieldDefinition, {includeAggregateArgs: true})}
      </DescriptionKeyLabel>
      {description ? <p>{description}</p> : null}
      <Separator />
      <DescriptionList>
        <Term>{t('Type')}</Term>
        <Details>
          {toTitleCase(fieldDefinition?.valueType ?? FieldValueType.STRING)}
        </Details>
      </DescriptionList>
    </DescriptionWrapper>
  );
}

const DescriptionWrapper = styled('div')`
  padding: ${space(0.75)} ${space(1)};
  max-width: 220px;
  font-size: ${p => p.theme.fontSizeSmall};

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
