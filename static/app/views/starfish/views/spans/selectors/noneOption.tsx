import styled from '@emotion/styled';

import {t} from 'sentry/locale';

export const NONE_OPTION_VALUE = '(none)';

const NoneContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;

export function NoneOption() {
  return <NoneContainer>{t(`(none)`)}</NoneContainer>;
}
