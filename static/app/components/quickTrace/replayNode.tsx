import {EventNodeReplay, StyledIconPlay} from 'sentry/components/quickTrace/styles';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types/event';

interface ReplayNodeProps {
  event: Event;
}

function ReplayNode({event}: ReplayNodeProps) {
  const hasReplay =
    event.entries?.some(({type}) => type === 'breadcrumbs') &&
    event.tags?.some(({key, value}) => key === 'replayId' && Boolean(value));

  return (
    <EventNodeReplay
      data-test-id="replay-node"
      to={{
        ...location,
        hash: '#breadcrumbs',
      }}
      onClick={
        hasReplay
          ? () => document.getElementById('breadcrumbs')?.scrollIntoView()
          : undefined
      }
      type={hasReplay ? 'black' : 'white'}
      icon={hasReplay && <StyledIconPlay size="xs" />}
      tooltipText={hasReplay ? '' : t('Replay cannot be found')}
    >
      {hasReplay ? t('Replay') : '???'}
    </EventNodeReplay>
  );
}

export default ReplayNode;
