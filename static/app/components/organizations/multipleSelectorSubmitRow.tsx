import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {growIn} from 'sentry/styles/animations';
import {space} from 'sentry/styles/space';

type Props = {
  onSubmit: () => void;
  disabled?: boolean;
};

function MultipleSelectorSubmitRow({onSubmit, disabled = false}: Props) {
  return (
    <SubmitButtonContainer>
      <SubmitButton disabled={disabled} onClick={onSubmit} size="xs" priority="primary">
        {t('Apply')}
      </SubmitButton>
    </SubmitButtonContainer>
  );
}

const SubmitButtonContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const SubmitButton = styled(Button)`
  animation: 0.1s ${growIn} ease-in;
  margin: ${space(0.5)} 0;
`;

export default MultipleSelectorSubmitRow;
