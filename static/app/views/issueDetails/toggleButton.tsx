import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';

interface IssueDetailsToggleButtonProps {
  isShown: boolean;
  setShownState: (boolean) => void;
}

function IssueDetailsToggleButton({
  isShown,
  setShownState,
}: IssueDetailsToggleButtonProps) {
  return (
    <ToggleButton priority="link" onClick={() => setShownState(!isShown)}>
      {isShown ? t('Hide Details') : t('Show Details')}
    </ToggleButton>
  );
}

const ToggleButton = styled(Button)`
  color: ${p => p.theme.subText};
  :hover,
  :focus {
    color: ${p => p.theme.textColor};
  }
  font-weight: bold;
`;

export default IssueDetailsToggleButton;
