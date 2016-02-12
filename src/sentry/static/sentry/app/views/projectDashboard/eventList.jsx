import React from 'react';
import ApiMixin from '../../mixins/apiMixin';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import {t} from '../../locale';

import EventNode from './eventNode';

const EventList = React.createClass({
  propTypes: {
    title: React.PropTypes.string.isRequired,
    endpoint: React.PropTypes.string.isRequired
  },

  mixins: [
    ApiMixin
  ],

  getInitialState() {
    return {
      groupList: [],
      loading: true,
      error: false,
      statsPeriod: '24h'
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps() {
    this.setState({
      loading: true,
      error: false
    }, this.fetchData);
  },

  fetchData() {
    let minutes;
    switch(this.state.statsPeriod) {
      case '15m':
        minutes = '15';
        break;
      case '60m':
        minutes = '60';
        break;
      case '24h':
      default:
        minutes = '1440';
        break;
    }

    this.api.request(this.props.endpoint, {
      query: {
        limit: 5,
        minutes: minutes
      },
      success: (data) => {
        this.setState({
          groupList: data,
          loading: false,
          error: false
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  onSelectStatsPeriod(period) {
    this.setState({
      statsPeriod: period
    });
  },

  render() {
    let eventNodes = this.state.groupList.map((item) => {
      return <EventNode group={item} key={item.id} />;
    });

    return (
      <div className="box dashboard-widget">
        <div className="box-header clearfix">
          <div className="row">
            <div className="col-xs-8">
              <h3>{this.props.title}</h3>
            </div>
            <div className="col-xs-2 align-right">{t('Events')}</div>
            <div className="col-xs-2 align-right">{t('Users')}</div>
          </div>
        </div>
        <div className="box-content">
          <div className="tab-pane active">
            {this.state.loading ?
              <LoadingIndicator />
            : (this.state.error ?
              <LoadingError onRetry={this.fetchData} />
            : (eventNodes.length ?
              <ul className="group-list group-list-small">
                {eventNodes}
              </ul>
            :
              <div className="group-list-empty">{t('No data available.')}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }
});

export default EventList;
