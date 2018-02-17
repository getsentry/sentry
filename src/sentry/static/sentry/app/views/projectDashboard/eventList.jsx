import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import jQuery from 'jquery';
import ApiMixin from '../../mixins/apiMixin';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import {t} from '../../locale';

import EventNode from './eventNode';

const EventList = createReactClass({
  displayName: 'EventList',

  propTypes: {
    type: PropTypes.oneOf(['new', 'priority']).isRequired,
    environment: PropTypes.object,
    dateSince: PropTypes.number,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      groupList: [],
      loading: true,
      error: false,
      statsPeriod: '24h',
      title: this.props.type === 'new' ? t('New issues') : t('Trending issues'),
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.environment !== this.props.environment) {
      this.setState(
        {
          loading: true,
          error: false,
        },
        this.fetchData
      );
    }
  },

  getEndpoint() {
    const {params, type, environment} = this.props;

    let qs = {
      sort: type,
      query: 'is:unresolved',
      since: this.props.dateSince,
    };

    if (environment) {
      qs.environment = environment.name;
      qs.query = `${qs.query} environment:${environment.name}`;
    }

    return `/projects/${params.orgId}/${params.projectId}/issues/?${jQuery.param(qs)}`;
  },

  getMinutes() {
    switch (this.state.statsPeriod) {
      case '15m':
        return '15';
      case '60m':
        return '60';
      case '24h':
      default:
        return '1440';
    }
  },

  fetchData() {
    const endpoint = this.getEndpoint();
    const minutes = this.getMinutes();

    this.api.request(endpoint, {
      query: {
        limit: 5,
        minutes,
      },
      success: data => {
        this.setState({
          groupList: data,
          loading: false,
          error: false,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });
  },

  onSelectStatsPeriod(period) {
    this.setState({
      statsPeriod: period,
    });
  },

  render() {
    let eventNodes = this.state.groupList.map(item => {
      return <EventNode group={item} key={item.id} />;
    });

    return (
      <div className="box dashboard-widget">
        <div className="box-header clearfix">
          <div className="row">
            <div className="col-xs-8">
              <h3>{this.state.title}</h3>
            </div>
            <div className="col-xs-2 align-right">{t('Events')}</div>
            <div className="col-xs-2 align-right">{t('Users')}</div>
          </div>
        </div>
        <div className="box-content">
          <div className="tab-pane active">
            {this.state.loading ? (
              <LoadingIndicator />
            ) : this.state.error ? (
              <LoadingError onRetry={this.fetchData} />
            ) : eventNodes.length ? (
              <ul className="group-list group-list-small">{eventNodes}</ul>
            ) : (
              <div className="group-list-empty">{t('No data available.')}</div>
            )}
          </div>
        </div>
      </div>
    );
  },
});

export default EventList;
