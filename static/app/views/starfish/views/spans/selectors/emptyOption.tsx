import styled from '@emotion/styled';

import {t} from 'sentry/locale';

export const EMPTY_OPTION_VALUE = '(empty)';

export const EmptyContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;

export function DefaultEmptyOption() {
  return <EmptyContainer>{t(`(empty string)`)}</EmptyContainer>;
}
