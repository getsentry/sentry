import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';

function WrappedButton({...props}) {
  return <Button {...props}>{t('Continue')}</Button>;
}

const ContinueButton = styled(WrappedButton)`
  margin-top: ${p => p.theme.space(1.5)};
`;

export default ContinueButton;
