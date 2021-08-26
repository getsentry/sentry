import styled from '@emotion/styled';

import Button from 'app/components/button';
import {t} from 'app/locale';
import {growIn} from 'app/styles/animations';
import space from 'app/styles/space';

type Props = {
  onSubmit: () => void;
  disabled?: boolean;
};

const MultipleSelectorSubmitRow = ({onSubmit, disabled = false}: Props) => (
  <SubmitButtonContainer>
    <SubmitButton disabled={disabled} onClick={onSubmit} size="xsmall" priority="primary">
      {t('Apply')}
    </SubmitButton>
  </SubmitButtonContainer>
);

const SubmitButtonContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const SubmitButton = styled(Button)`
  animation: 0.1s ${growIn} ease-in;
  margin: ${space(0.5)} 0;
`;

export default MultipleSelectorSubmitRow;
