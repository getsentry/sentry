import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {loadIncidents} from 'sentry/actionCreators/serviceIncidents';
import Button from 'sentry/components/button';
import {IS_ACCEPTANCE_TEST} from 'sentry/constants';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SentryServiceStatus} from 'sentry/types';

import List from '../list';
import ListItem from '../list/listItem';

import SidebarItem from './sidebarItem';
import SidebarPanel from './sidebarPanel';
import SidebarPanelEmpty from './sidebarPanelEmpty';
import SidebarPanelItem from './sidebarPanelItem';
import {CommonSidebarProps} from './types';

type Props = CommonSidebarProps;

function ServiceIncidents({
  currentPanel,
  onShowPanel,
  hidePanel,
  collapsed,
  orientation,
}: Props) {
  const [status, setStatus] = useState<SentryServiceStatus | null>(null);

  async function fetchData() {
    try {
      setStatus(await loadIncidents());
    } catch (e) {
      Sentry.withScope(scope => {
        scope.setLevel('warning');
        scope.setFingerprint(['ServiceIncidents-fetchData']);
        Sentry.captureException(e);
      });
    }
  }

  useEffect(() => void fetchData(), []);

  // Never render incidents in acceptance tests
  if (IS_ACCEPTANCE_TEST) {
    return null;
  }

  if (!status) {
    return null;
  }

  const active = currentPanel === 'statusupdate';
  const isEmpty = !status.incidents || status.incidents.length === 0;

  if (isEmpty) {
    return null;
  }

  return (
    <Fragment>
      <SidebarItem
        id="statusupdate"
        orientation={orientation}
        collapsed={collapsed}
        active={active}
        icon={<IconWarning size="md" />}
        label={t('Service status')}
        onClick={onShowPanel}
      />
      {active && status && (
        <SidebarPanel
          orientation={orientation}
          title={t('Recent service updates')}
          hidePanel={hidePanel}
          collapsed={collapsed}
        >
          {isEmpty && (
            <SidebarPanelEmpty>{t('There are no incidents to report')}</SidebarPanelEmpty>
          )}
          <div className="incident-list">
            {status.incidents.map(incident => (
              <SidebarPanelItem
                title={incident.name}
                message={t('Latest updates')}
                key={incident.id}
              >
                {incident.updates ? (
                  <List>
                    {incident.updates.map((update, key) => (
                      <ListItem key={key}>{update}</ListItem>
                    ))}
                  </List>
                ) : null}
                <ActionBar>
                  <Button href={incident.url} size="small" external>
                    {t('Learn more')}
                  </Button>
                </ActionBar>
              </SidebarPanelItem>
            ))}
          </div>
        </SidebarPanel>
      )}
    </Fragment>
  );
}

export default ServiceIncidents;

const ActionBar = styled('div')`
  margin-top: ${space(2)};
`;
