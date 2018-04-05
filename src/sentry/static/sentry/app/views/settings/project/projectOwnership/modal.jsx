import React from 'react';
import PropTypes from 'prop-types';
import {uniq} from 'lodash';
import idx from 'idx';

import {t} from '../../../../locale';
import AsyncView from '../../../asyncView';

import SentryTypes from '../../../../proptypes';
import OwnerInput from './ownerInput';

class ProjectOwnershipModal extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    issueId: PropTypes.string,
    onSave: PropTypes.func,
  };

  getEndpoints() {
    let {organization, project, issueId} = this.props;
    return [
      ['ownership', `/projects/${organization.slug}/${project.slug}/ownership/`],
      ['urlTagData', `/issues/${issueId}/tags/url/`],
      ['eventData', `/issues/${issueId}/events/latest/`],
    ];
  }

  renderBody() {
    let {ownership, urlTagData, eventData} = this.state;
    let urls = urlTagData.topValues
      .sort((a, b) => a.count - b.count)
      .map(i => i.value)
      .slice(0, 5);
    let paths = uniq(
      idx(eventData.entries.find(({type}) => type == 'exception'), _ =>
        _.data.values[0].stacktrace.frames.map(frame => frame.filename || frame.absPath)
      )
    );

    return (
      <React.Fragment>
        <p>{t('Match against Issue Data: (globbing syntax *, ? supported)')}</p>
        <OwnerInput
          {...this.props}
          initialText={ownership.raw || ''}
          urls={urls}
          paths={paths}
          onSave={this.props.onSave}
        />
      </React.Fragment>
    );
  }
}

export default ProjectOwnershipModal;
