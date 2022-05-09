import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';

type Props = {
  className?: string;
};

function PlayButtonOverlay({className}: Props) {
  const {togglePlayPause} = useReplayContext();

  return (
    <Overlay className={className}>
      <PlayButton
        title={t('Play')}
        onClick={() => togglePlayPause(true)}
        aria-label={t('Play')}
      >
        {'\u25B6'}
      </PlayButton>
    </Overlay>
  );
}

/* Position the badge in the center */
const Overlay = styled('div')`
  background: rgba(255, 255, 255, 0.75);
  user-select: none;
  display: grid;
  place-items: center;
`;

const PlayButton = styled(Button)`
  color: white;
  font-size: 46px;
  width: 80px;
  height: 80px;
  background: ${p => p.theme.purple400};
  border-radius: 50%;
  padding: 5px 0 0 10px;

  :hover {
    color: ${p => p.theme.purple400};
    border-color: ${p => p.theme.purple400};
  }
`;

export default PlayButtonOverlay;
