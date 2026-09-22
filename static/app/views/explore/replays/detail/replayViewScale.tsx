import styled from '@emotion/styled';

import {DescriptionList} from '@sentry/scraps/descriptionList';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconRuler} from 'sentry/icons/iconRuler';
import {t} from 'sentry/locale';
import {toPercent} from 'sentry/utils/number/toPercent';
import {useReplayPlayerSize} from 'sentry/utils/replays/playback/providers/replayPlayerSizeContext';

interface Props {
  isLoading: boolean;
}

export function ReplayViewScale({isLoading}: Props) {
  const {dimensions} = useReplayContext();
  const [{scale}] = useReplayPlayerSize();

  if (isLoading) {
    return <Placeholder width="20px" height="20px" />;
  }

  return (
    <Tooltip
      skipWrapper
      title={
        <NoWrapDescriptionList gap="md 2xl">
          <DescriptionList.Term>{t('Original size')}</DescriptionList.Term>
          <DescriptionList.Details>
            {dimensions.width} &times; {dimensions.height}
          </DescriptionList.Details>
          <DescriptionList.Term>{t('Rendered size')}</DescriptionList.Term>
          <DescriptionList.Details>{toPercent(scale, 1)}</DescriptionList.Details>
        </NoWrapDescriptionList>
      }
    >
      <IconRuler size="md" />
    </Tooltip>
  );
}

// The replay video panel squeezes this tooltip narrow enough that dimensions
// would otherwise break mid-number.
const NoWrapDescriptionList = styled(DescriptionList)`
  white-space: nowrap;
`;
