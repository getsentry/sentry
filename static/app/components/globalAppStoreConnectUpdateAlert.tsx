import {useContext, useState} from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import {IconUpgrade} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import AppStoreConnectContext from 'app/views/settings/project/appStoreConnectContext';

type Props = {
  api: Client;
  Wrapper?: React.ComponentType;
};

function GlobalAppStoreConnectUpdateAlert({api, Wrapper}: Props) {
  const appStoreConnectContext = useContext(AppStoreConnectContext);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || !appStoreConnectContext) {
    return null;
  }

  function handleDismiss() {}

  const notice = (
    <Alert type="info" icon={<IconUpgrade />}>
      <Content>
        {t(
          `You have expired App Store Connect sessions in your projects. Revalidate them to continue syncing Sentry with App Store Connect.`
        )}
        <Actions>
          <Button
            priority="link"
            title={t('Dismiss for the next two weeks')}
            onClick={handleDismiss}
          >
            {t('Remind me later')}
          </Button>
          |
          <Button
            priority="link"
            // onClick={() => {
            //   SidebarPanelActions.activatePanel(SidebarPanelKey.Broadcasts);
            //   recordAnalyticsClicked({organization});
            // }}
          >
            {t('Review updates')}
          </Button>
        </Actions>
      </Content>
    </Alert>
  );

  return Wrapper ? <Wrapper>{notice}</Wrapper> : notice;
}

export default withApi(GlobalAppStoreConnectUpdateAlert);

const Actions = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, max-content);
  grid-gap: ${space(1)};
`;

const Content = styled('div')`
  display: flex;
  flex-wrap: wrap;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    justify-content: space-between;
  }
`;
