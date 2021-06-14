import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = {
  message?: React.ReactNode;
};

function NoStackTraceMessage({message}: Props) {
  return (
    <StyledAlert type="error">
      <i>{message ?? t('No or unknown stacktrace')}</i>
    </StyledAlert>
  );
}

export default NoStackTraceMessage;

const StyledAlert = styled(Alert)`
  border-color: ${p => p.theme.border};
  padding: ${space(1)} ${space(3)};
  font-size: ${p => p.theme.fontSizeMedium};
`;
