import styled from '@emotion/styled';

import {EventNode} from 'sentry/components/quickTrace/styles';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';

type Props = {
  hasReplay: boolean;
};

function ReplayNode({hasReplay}: Props) {
  const location = useLocation();
  if (hasReplay) {
    return (
      <EventNodeReplay
        data-test-id="replay-node"
        to={{...location, hash: '#breadcrumbs'}}
        onClick={() => document.getElementById('breadcrumbs')?.scrollIntoView()}
        type="black"
        icon={<IconPlay size="xs" />}
        tooltipText=""
      >
        {t('Replay')}
      </EventNodeReplay>
    );
  }
  return (
    <EventNodeReplay
      data-test-id="replay-node"
      disabled
      icon={null}
      tooltipText={t('Replay cannot be found')}
      type="white"
    >
      {t('???')}
    </EventNodeReplay>
  );
}

export const EventNodeReplay = styled(EventNode)`
  display: inline-flex;
  margin-right: ${space(1)};
  margin-top: ${space(0.5)};
`;

export default ReplayNode;
