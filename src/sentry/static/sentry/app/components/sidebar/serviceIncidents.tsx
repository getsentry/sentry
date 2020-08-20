import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {t} from 'app/locale';
import Button from 'app/components/button';
import {IconWarning} from 'app/icons';
import {loadIncidents} from 'app/actionCreators/serviceIncidents';
import {SentryServiceStatus} from 'app/types';
import space from 'app/styles/space';

import {CommonSidebarProps} from './types';
import SidebarPanelEmpty from './sidebarPanelEmpty';
import SidebarItem from './sidebarItem';
import SidebarPanel from './sidebarPanel';

type Props = CommonSidebarProps;

type State = {
  status: SentryServiceStatus | null;
};

class ServiceIncidents extends React.Component<Props, State> {
  state: State = {
    status: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  async fetchData() {
    try {
      const status = await loadIncidents();
      this.setState({status});
    } catch (e) {
      Sentry.withScope(scope => {
        scope.setLevel(Sentry.Severity.Warning);
        Sentry.captureException(e);
      });
    }
  }

  render() {
    const {
      currentPanel,
      showPanel,
      onShowPanel,
      hidePanel,
      collapsed,
      orientation,
    } = this.props;
    const {status} = this.state;

    if (!status) {
      return null;
    }

    const active = currentPanel === 'statusupdate';
    const isEmpty = !status.incidents || status.incidents.length === 0;

    if (isEmpty) {
      return null;
    }

    return (
      <React.Fragment>
        <SidebarItem
          id="statusupdate"
          orientation={orientation}
          collapsed={collapsed}
          active={active}
          icon={<IconWarning className="animated pulse infinite" />}
          label={t('Service status')}
          onClick={onShowPanel}
        />
        {showPanel && active && status && (
          <SidebarPanel
            orientation={orientation}
            title={t('Recent status updates')}
            hidePanel={hidePanel}
            collapsed={collapsed}
          >
            {isEmpty && (
              <SidebarPanelEmpty>
                {t('There are no incidents to report')}
              </SidebarPanelEmpty>
            )}
            <IncidentList className="incident-list">
              {status.incidents.map(incident => (
                <IncidentItem key={incident.id}>
                  <IncidentTitle>{incident.name}</IncidentTitle>
                  {incident.updates ? (
                    <div>
                      <StatusHeader>{t('Latest updates:')}</StatusHeader>
                      <StatusList>
                        {incident.updates.map((update, key) => (
                          <StatusItem key={key}>{update}</StatusItem>
                        ))}
                      </StatusList>
                    </div>
                  ) : null}
                  <div>
                    <Button href={incident.url} size="small" external>
                      {t('Learn more')}
                    </Button>
                  </div>
                </IncidentItem>
              ))}
            </IncidentList>
          </SidebarPanel>
        )}
      </React.Fragment>
    );
  }
}

export default ServiceIncidents;

const IncidentList = styled('ul')`
  font-size: 13px;
  list-style: none;
  padding: ${space(3)} ${space(3)} 0;
`;

const IncidentItem = styled('li')`
  border-bottom: 1px solid ${p => p.theme.borderLight};
  margin-bottom: ${space(3)};
  padding-bottom: ${space(0.75)};
`;

const IncidentTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: ${space(2)};
`;
const StatusHeader = styled('div')`
  color: #7c6a8e;
  margin-bottom: ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
  line-height: 1;
`;
const StatusList = styled('ul')`
  list-style: none;
  padding: 0;
`;
const StatusItem = styled('li')`
  margin-bottom: ${space(2)};
  line-height: 1.5;
`;
