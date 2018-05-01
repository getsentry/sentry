import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import IncidentStore from 'app/stores/incidentStore';
import InlineSvg from 'app/components/inlineSvg';

import SidebarItem from './sidebarItem';
import SidebarPanel from './sidebarPanel';
import SidebarPanelEmpty from './sidebarPanelEmpty';

const Incidents = createReactClass({
  displayName: 'Incidents',

  propTypes: {
    orientation: PropTypes.oneOf(['top', 'left']),
    collapsed: PropTypes.bool,
    showPanel: PropTypes.bool,
    currentPanel: PropTypes.string,
    hidePanel: PropTypes.func,
    onShowPanel: PropTypes.func.isRequired,
  },

  mixins: [Reflux.listenTo(IncidentStore, 'onIncidentChange')],

  getInitialState() {
    return {
      status: null,
    };
  },

  onIncidentChange(status) {
    this.setState({
      status: {...status},
    });
  },

  render() {
    let {
      orientation,
      collapsed,
      currentPanel,
      showPanel,
      hidePanel,
      onShowPanel,
    } = this.props;

    let {status} = this.state;
    if (!status) return null;

    let active = currentPanel === 'statusupdate';
    let isEmpty = !status.incidents || status.incidents.length === 0;

    if (isEmpty) return null;

    return (
      <React.Fragment>
        <SidebarItem
          id="statusupdate"
          orientation={orientation}
          collapsed={collapsed}
          active={active}
          icon={
            <InlineSvg
              src="icon-circle-exclamation"
              className="animated pulse infinite"
            />
          }
          label={t('Service status')}
          onClick={onShowPanel}
        />
        {showPanel &&
          active &&
          status && (
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
                    <IncidentTitle>{incident.title}</IncidentTitle>
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
  },
});

export default Incidents;

const IncidentList = styled('ul')`
  list-style: none;
  padding: 20px 20px 0;
  font-size: 13px;
`;

const IncidentItem = styled('li')`
  border-bottom: 1px solid ${p => p.theme.borderLight};
  margin-bottom: 20px;
  padding-bottom: 5px;
`;

const IncidentTitle = styled('div')`
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 15px;
`;
const StatusHeader = styled('div')`
  color: #7c6a8e;
  margin-bottom: 15px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
`;
const StatusList = styled('ul')`
  list-style: none;
  padding: 0;
`;
const StatusItem = styled('li')`
  margin-bottom: 15px;
  line-height: 1.5;
`;
