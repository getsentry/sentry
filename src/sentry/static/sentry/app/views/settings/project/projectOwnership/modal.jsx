import React from 'react';
import PropTypes from 'prop-types';
import uniq from 'lodash/uniq';

import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import SentryTypes from 'app/sentryTypes';
import OwnerInput from 'app/views/settings/project/projectOwnership/ownerInput';

class ProjectOwnershipModal extends AsyncComponent {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    issueId: PropTypes.string,
    onSave: PropTypes.func,
  };

  getEndpoints() {
    const {organization, project, issueId} = this.props;
    return [
      ['ownership', `/projects/${organization.slug}/${project.slug}/ownership/`],
      [
        'urlTagData',
        `/issues/${issueId}/tags/url/`,
        {},
        {
          allowError: error =>
            // Allow for 404s
            error.status === 404,
        },
      ],
      ['eventData', `/issues/${issueId}/events/latest/`],
    ];
  }

  renderBody() {
    const {ownership, urlTagData, eventData} = this.state;
    const urls = urlTagData
      ? urlTagData.topValues
          .sort((a, b) => a.count - b.count)
          .map(i => i.value)
          .slice(0, 5)
      : [];

    // pull frame data out of exception or the stacktrace
    let frames =
      eventData.entries.find(({type}) => type === 'exception')?.data?.values?.[0]
        ?.stacktrace?.frames ||
      eventData.entries.find(({type}) => type === 'stacktrace')?.data?.frames ||
      [];

    //filter frames by inApp unless there would be 0
    const inAppFrames = frames.filter(frame => frame.inApp);
    if (inAppFrames.length > 0) {
      frames = inAppFrames;
    }

    const paths = uniq(
      frames.map(frame => frame.filename || frame.absPath).filter(i => i)
    ).slice(0, 30);

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
