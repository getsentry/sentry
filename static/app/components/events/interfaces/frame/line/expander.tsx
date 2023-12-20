import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {SLOW_TOOLTIP_DELAY} from 'sentry/constants';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PlatformKey} from 'sentry/types';

type Props = {
  isExpandable: boolean;
  onToggleContext: (evt: React.MouseEvent) => void;
  platform: PlatformKey;
  isExpanded?: boolean;
  isHoverPreviewed?: boolean;
};

function Expander({isExpandable, isHoverPreviewed, isExpanded, onToggleContext}: Props) {
  if (!isExpandable) {
    return null;
  }

  return (
    <StyledButton
      className="btn-toggle"
      size="zero"
      title={t('Toggle Context')}
      tooltipProps={isHoverPreviewed ? {delay: SLOW_TOOLTIP_DELAY} : undefined}
      onClick={onToggleContext}
    >
      <IconChevron direction={isExpanded ? 'up' : 'down'} legacySize="8px" />
    </StyledButton>
  );
}

export default Expander;

// the Button's label has the padding of 3px because the button size has to be 16x16 px.
const StyledButton = styled(Button)`
  margin-left: ${space(1)};
  span:first-child {
    padding: 3px;
  }
`;
