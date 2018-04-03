import React from 'react';
import PropTypes from 'prop-types';
import {uniq} from 'lodash';

import {t} from '../../../../locale';
import AsyncView from '../../../asyncView';

import SentryTypes from '../../../../proptypes';
import OwnerInput from './ownerInput';

class Modal extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    issueId: PropTypes.string,
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

    let urls = urlTagData.topValues.map(i => i.value);
    let paths = uniq(
      eventData.entries
        .find(({type}) => type == 'exception')
        .data.values[0].stacktrace.frames.map(frame => frame.filename || frame.absPath)
    );

    return (
      <React.Fragment>
        <h3>{t('Create Ownership Rule for Issue:')}</h3>
        <OwnerInput
          {...this.props}
          initialText={ownership.raw || ''}
          urls={urls}
          paths={paths}
        />
      </React.Fragment>
    );
  }
}

export default Modal;
