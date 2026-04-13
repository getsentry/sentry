import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';

function WrappedButton({...props}) {
  return <Button {...props}>{t('Continue')}</Button>;
}

export const ContinueButton = styled(WrappedButton)`
  margin-top: ${p => p.theme.space.lg};
`;
