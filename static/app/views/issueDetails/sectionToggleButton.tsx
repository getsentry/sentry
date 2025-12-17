import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';

interface SectionToggleButtonProps {
  isExpanded: boolean;
  onExpandChange: (state: boolean) => void;
}

function SectionToggleButton({
  isExpanded,
  onExpandChange,
  ...props
}: SectionToggleButtonProps) {
  return (
    <ToggleButton priority="link" onClick={() => onExpandChange(!isExpanded)} {...props}>
      {isExpanded ? t('Hide Details') : t('Show Details')}
    </ToggleButton>
  );
}

const ToggleButton = styled(Button)`
  color: ${p => p.theme.subText};
  :hover,
  :focus {
    color: ${p => p.theme.tokens.content.primary};
  }
  font-weight: ${p => p.theme.fontWeight.bold};
`;

export default SectionToggleButton;
