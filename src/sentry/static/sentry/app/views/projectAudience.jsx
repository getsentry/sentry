import jQuery from 'jquery';
import React from 'react';
import {browserHistory} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';

export default React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('audience');
    this.fetchData();
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getEndpoint(), {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          data: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  getEndpoint() {
    let {orgId, projectId} = this.props.params;
    return `/projects/${orgId}/${projectId}/audience/`;
  },

  renderBody() {
    let body;

    let params = this.props.params;

    if (this.state.loading)
      body = this.renderLoading();
    else if (this.state.error)
      body = <LoadingError onRetry={this.fetchData} />;
    else
      body = this.renderEmpty();

    return body;
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  render() {
    return (
      <div>
        <div className="row release-list-header">
          <div className="col-sm-7">
            <h3>{t('Releases')}</h3>
          </div>
          <div className="col-sm-5 release-search">
            <SearchBar defaultQuery=""
              placeholder={t('Search for a release.')}
              query={this.state.query}
              onSearch={this.onSearch}
            />
          </div>
        </div>
        <div className="panel panel-default">
          <div className="panel-heading panel-heading-bold">
            <div className="row">
              <div className="col-sm-8 col-xs-7">{t('Version')}</div>
              <div className="col-sm-2 col-xs-3">
                {t('New Issues')}
              </div>
              <div className="col-sm-2 col-xs-2">
                {t('Last Event')}
              </div>
            </div>
          </div>
          {this.renderStreamBody()}
        </div>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  }
});
