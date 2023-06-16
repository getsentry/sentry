import styled from '@emotion/styled';

import {IconClock} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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
  gap: ${space(0.75)};
  place-items: center;

  padding: ${space(3)};
  background: ${p => p.theme.gray300};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.white};
  z-index: ${p => p.theme.zIndex.initial};
`;

export default BufferingOverlay;
