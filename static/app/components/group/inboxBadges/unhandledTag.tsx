import styled from '@emotion/styled';

import {t} from 'sentry/locale';

export function UnhandledTag() {
  return <UnhandledTagWrapper>{t('Unhandled')}</UnhandledTagWrapper>;
}

const UnhandledTagWrapper = styled('div')`
  display: flex;
  align-items: center;
  white-space: nowrap;
  color: ${p => p.theme.tokens.content.danger};
`;
