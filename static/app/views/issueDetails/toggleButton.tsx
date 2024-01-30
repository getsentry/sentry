import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';

interface IssueDetailsToggleButtonProps {
  isShown: boolean;
  onShownChange: (state: boolean) => void;
}

function IssueDetailsToggleButton({
  isShown,
  onShownChange,
}: IssueDetailsToggleButtonProps) {
  return (
    <ToggleButton priority="link" onClick={() => onShownChange(!isShown)}>
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
