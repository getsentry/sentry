import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import EnvironmentStore from '../stores/environmentStore';
import Panel from './settings/components/panel';
import PanelHeader from './settings/components/panelHeader';
import PanelBody from './settings/components/panelBody';
import EmptyMessage from './settings/components/emptyMessage';
import {t} from '../locale';
import Row from './settings/components/row';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import ListLink from '../components/listLink';

const ProjectEnvironments = createReactClass({
  mixins: [Reflux.listenTo(EnvironmentStore, 'onEnvironmentsChange')],
  getInitialState() {
    return {
      environments: EnvironmentStore.getAll(),
    };
  },
  onEnvironmentsChange() {
    this.setState({
      environments: EnvironmentStore.getAll(),
    });
  },
  renderEmpty() {
    return <EmptyMessage>{t("You don't have any environments yet.")}</EmptyMessage>;
  },
  renderEnvironmentList(envs) {
    return envs.map(env => <Row key={env.id}>{env.displayName}</Row>);
  },
  render() {
    let {environments} = this.state;
    let {orgId, projectId} = this.props.params;

    return (
      <div>
        <SettingsPageHeader
          title={t('Manage Environments')}
          tabs={
            <ul className="nav nav-tabs" style={{borderBottom: '1px solid #ddd'}}>
              <ListLink to={`/${orgId}/${projectId}/settings/environments/`} index={true}>
                {t('Environments')}
              </ListLink>
            </ul>
          }
        />
        <Panel>
          <PanelHeader>{t('Environments')}</PanelHeader>
          <PanelBody>
            {environments.length
              ? this.renderEnvironmentList(environments)
              : this.renderEmpty()}
          </PanelBody>
        </Panel>
      </div>
    );
  },
});

export default ProjectEnvironments;
