import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import * as Sentry from '@sentry/browser';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import {analytics} from 'app/utils/analytics';
import {t} from 'app/locale';
import Button from 'app/components/button';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

class CreateSampleEventButton extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project.isRequired,
    source: PropTypes.string.isRequired,
  };

  state = {
    creating: false,
  };

  componentDidMount() {
    const {organization, project, source} = this.props;

    if (!project) {
      return;
    }

    const data = {
      org_id: parseInt(organization.id, 10),
      project_id: parseInt(project.id, 10),
      source,
    };
    analytics('sample_event.button_viewed', data);
  }

  createSampleEvent = async () => {
    // TODO(dena): swap out for action creator
    const {api, organization, project, source} = this.props;
    const url = `/projects/${organization.slug}/${project.slug}/create-sample/`;

    analytics('sample_event.created', {
      org_id: parseInt(organization.id, 10),
      project_id: parseInt(project.id, 10),
      source,
    });

    this.setState({creating: true});
    try {
      const data = await api.requestPromise(url, {method: 'POST'});

      const issueUrl = `/organizations/${organization.slug}/issues/${data.groupID}/`;
      browserHistory.push(issueUrl);
    } catch (error) {
      Sentry.withScope(scope => {
        scope.setExtra('error', error);
        Sentry.captureException(new Error('Failed to create sample event'));
      });
      addSuccessMessage(t('Unable to create a sample event'));
    }
    this.setState({creating: false});
  };

  render() {
    // eslint-disable-next-line no-unused-vars
    const {api, organization, project, source, ...props} = this.props;
    const {creating} = this.state;

    return <Button disabled={creating} onClick={this.createSampleEvent} {...props} />;
  }
}

export default withApi(withOrganization(CreateSampleEventButton));
