import React from 'react';

import EventDataSection from './eventDataSection';
import PropTypes from '../../proptypes';
import ProjectState from '../../mixins/projectState';
import ApiMixin from '../../mixins/apiMixin';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import {t} from '../../locale';

const ReprocessingHint = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired
  },

  mixins: [ProjectState, ApiMixin],

  getInitialState() {
    return {
      hideHint: false,
      loading: true,
      projectSettings: null
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  shouldComponentUpdate(nextProps, nextState) {
    if (this.state.hideHint != nextState.hideHint) {
      return true;
    }
    if (this.state.projectSettings != nextState.projectSettings) {
      return true;
    }
    if (this.state.loading != nextState.loading) {
      return true;
    }
    return this.props.event.id !== nextProps.event.id;
  },

  fetchData() {
    if (this.state.projectSettings !== null) {
      return;
    }
    this.setState({
      loading: true
    });
    this.api.request(`/projects/${this.props.orgId}/${this.props.projectId}/`, {
      success: (data, _, jqXHR) => {
        this.setState({
          projectSettings: data.options
        });
      },
      complete: () => {
        this.setState({
          loading: false
        });
      }
    });
  },

  hide() {
    this.setState({hideHint: !this.state.hideHint});
    // Fire and forget
    this.api.request(`/projects/${this.props.orgId}/${this.props.projectId}/`, {
      method: 'PUT',
      data: {options: {'sentry:reprocessing_show_hint': false}}
    });
  },

  renderHint() {
    let link = `/${this.props.orgId}/${this.props.projectId}/settings/processing-issues/`;

    return (
      <EventDataSection
        group={this.props.group}
        event={this.props.event}
        type="hint"
        className="errors hint"
      >
        <span className="icon icon-question event" />
        <p>
          <a className="pull-right" onClick={this.hide}>{t('Dismiss')}</a>
          {t('Errors like these can be fixed with reprocessing')}
          {' '}
          <small><a style={{marginLeft: 10}} href={link}>{t('Show me')}</a></small>
        </p>
      </EventDataSection>
    );
  },

  render() {
    let errors = this.props.event.errors;
    let hideHint = this.state.hideHint;
    let shouldRender = true;

    if (hideHint || this.state.loading || this.state.projectSettings === null) {
      shouldRender = false;
    }

    if (
      this.state.projectSettings !== null &&
      (this.state.projectSettings['sentry:reprocessing_show_hint'] === false ||
        this.state.projectSettings['sentry:reprocessing_active'] === true)
    ) {
      shouldRender = false;
    }

    let reprocessingFixable = false;
    errors.map(error => {
      if (error.type == 'native_missing_dsym') {
        reprocessingFixable = true;
      }
    });

    shouldRender = shouldRender && reprocessingFixable;

    return (
      <ReactCSSTransitionGroup
        transitionName="hint"
        transitionEnterTimeout={500}
        transitionLeaveTimeout={500}
      >
        {shouldRender ? this.renderHint() : null}
      </ReactCSSTransitionGroup>
    );
  }
});

export default ReprocessingHint;
