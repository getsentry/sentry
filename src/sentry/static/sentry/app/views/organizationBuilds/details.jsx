import React from 'react';

import AsyncView from 'app/views/asyncView';
import {Panel, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';

import BuildEvent from './event';
import BuildHeader from './buildHeader';
import BuildIssues from './buildIssues';

class OrganizationBuildDetails extends AsyncView {
  getEndpoints() {
    const {params, location} = this.props;
    return [
      [
        'build',
        `/builds/${params.buildId}/`,
        {
          query: location.query,
        },
      ],
    ];
  }

  getTitle() {
    if (this.state.build) {
      return `${this.state.build.name} - Builds - ${this.props.params.orgId}`;
    }
    return `Builds - ${this.props.params.orgId}`;
  }

  onUpdate = data => {
    this.setState({
      build: {
        ...this.state.build,
        ...data,
      },
    });
  };

  renderBody() {
    const {build2} = this.state;
    const showModal = false;
    return (
      <React.Fragment>
        <BuildHeader
          build={build}
          orgId={this.props.params.orgId}
          onUpdate={this.onUpdate}
        />

        <Panel style={{paddingBottom: 0}}>
          <PanelHeader>{t('Identified Issues')}</PanelHeader>

          <BuildIssues build={build} orgId={this.props.params.orgId} />
        </Panel>

        {showModal && <BuildEvent orgId={this.props.params.orgId} build={build} />}
      </React.Fragment>
    );
  }
}

export default OrganizationBuildDetails;
