import {browserHistory} from 'react-router';
import React from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import {analytics} from 'app/utils/analytics';
import ApiMixin from 'app/mixins/apiMixin';
import Button from 'app/components/button';
import IndicatorStore from 'app/stores/indicatorStore';
import sdk from 'app/utils/sdk';

const SampleEvent = createReactClass({
  displayName: 'sampleEvent',

  propTypes: {
    params: PropTypes.object.isRequired,
    source: PropTypes.string.isRequired,
  },

  contextTypes: {
    organization: PropTypes.object,
  },

  mixins: [ApiMixin],

  createSampleEvent() {
    // TODO(DENA): if experiment is successful-create util function
    let {orgId, projectId} = this.props.params;
    let {organization} = this.context;
    let url = `/projects/${orgId}/${projectId}/create-sample/`;
    let project = organization.projects.find(proj => proj.slug === projectId);

    analytics('sample_event.created', {
      org_id: parseInt(organization.id, 10),
      project_id: parseInt(project.id, 10),
      source: 'installation',
    });

    this.api.request(url, {
      method: 'POST',
      success: data => {
        browserHistory.push(`/${orgId}/${projectId}/issues/${data.groupID}/`);
      },
      error: err => {
        sdk.captureException(
          new Error('Create sample event in onboarding configure step failed'),
          {
            extra: err,
          }
        );

        IndicatorStore.addError('Unable to create a sample event');
      },
    });
  },

  render() {
    let {source} = this.props;

    return source === 'waiting' ? (
      <StyledButton priority="link" onClick={this.createSampleEvent}>
        Or See Sample Event
      </StyledButton>
    ) : (
      <div className="pull-right">
        <StyledButton priority="primary" onClick={this.createSampleEvent}>
          Or See Sample Event
        </StyledButton>
      </div>
    );
  },
});

const StyledButton = styled(Button)`
  div {
    padding: 0;
  }
`;

export default SampleEvent;
