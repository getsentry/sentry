import styled from '@emotion/styled';

import {IconClock} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  className?: string;
};

function BufferingOverlay({className}: Props) {
  return (
    <Overlay className={className}>
      <Message>
        <IconClock size="sm" />
        {t('Buffering...')}
      </Message>
    </Overlay>
  );
}

/* Position the badge in the corner */
const Overlay = styled('div')`
  user-select: none;
  display: grid;
  place-items: center;
`;

/* Badge layout and style */
const Message = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content;
  gap: ${p => p.theme.space.sm};
  place-items: center;

  padding: ${p => p.theme.space['2xl']};
  background: ${p => p.theme.colors.gray400};
  border-radius: ${p => p.theme.radius.md};
  color: ${p => p.theme.colors.white};
  z-index: ${p => p.theme.zIndex.initial};
`;

export default BufferingOverlay;
