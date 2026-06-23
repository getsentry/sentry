import styled from '@emotion/styled';

import {t} from 'sentry/locale';

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;
export const emptyValue = <EmptyValueContainer>{t('(no value)')}</EmptyValueContainer>;
export const emptyStringValue = (
  <EmptyValueContainer>{t('(empty string)')}</EmptyValueContainer>
);
