import styled from '@emotion/styled';

import {EventNode} from 'sentry/components/quickTrace/styles';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';

type Props = {
  hasReplay: boolean;
};

function ReplayNode({hasReplay}: Props) {
  const location = useLocation();
  const isDarkmode = useLegacyStore(ConfigStore).theme === 'dark';

  if (hasReplay) {
    return (
      <EventNodeReplay
        icon={<StyledIcon size="xs" isDarkmode={isDarkmode} />}
        onClick={() => document.getElementById('breadcrumbs')?.scrollIntoView()}
        to={{...location, hash: '#breadcrumbs'}}
        type="black"
      >
        {t('Replay')}
      </EventNodeReplay>
    );
  }
  return (
    <EventNodeReplay
      disabled
      icon={null}
      tooltipText={t('Replay cannot be found')}
      type="white"
    >
      {t('???')}
    </EventNodeReplay>
  );
}

const StyledIcon = styled(IconPlay)<{isDarkmode: boolean}>`
  fill: ${p => (p.isDarkmode ? p.theme.black : p.theme.white)};
`;

export const EventNodeReplay = styled(EventNode)`
  display: inline-flex;
  margin-right: ${space(1)};
  margin-top: ${space(0.5)};
`;

export default ReplayNode;
