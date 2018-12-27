import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

import {Panel, PanelBody} from 'app/components/panels';
import ApiMixin from 'app/mixins/apiMixin';
import CompactIssue from 'app/components/compactIssue';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import {t} from 'app/locale';

const IssueList = createReactClass({
  displayName: 'IssueList',

  propTypes: {
    endpoint: PropTypes.string.isRequired,
    emptyText: PropTypes.string,
    query: PropTypes.object,
    pagination: PropTypes.bool,
    renderEmpty: PropTypes.func,
    statsPeriod: PropTypes.string,
    showActions: PropTypes.bool,
    noBorder: PropTypes.bool,
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      pagination: true,
      query: {},
      noBorder: false,
    };
  },

  getInitialState() {
    return {
      issueIds: [],
      loading: true,
      error: false,
      pageLinks: null,
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    let location = this.props.location;
    let nextLocation = nextProps.location;
    if (!location) return;

    if (
      location.pathname != nextLocation.pathname ||
      location.search != nextLocation.search
    ) {
      this.remountComponent();
    }
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData() {
    let location = this.props.location;
    this.api.clear();
    this.api.request(this.props.endpoint, {
      method: 'GET',
      query: {
        cursor: (location && location.query && location.query.cursor) || '',
        ...this.props.query,
      },
      success: (data, _, jqXHR) => {
        this.setState({
          data,
          loading: false,
          error: false,
          issueIds: data.map(item => item.id),
          pageLinks: jqXHR.getResponseHeader('Link'),
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

  renderResults() {
    let body;
    const {params, noBorder} = this.props;

    if (this.state.loading) body = this.renderLoading();
    else if (this.state.error) body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.issueIds.length > 0) {
      const panelStyle = noBorder ? {border: 0, borderRadius: 0} : {};

      body = (
        <Panel style={panelStyle}>
          <PanelBody className="issue-list">
            {this.state.data.map(issue => {
              return (
                <CompactIssue
                  key={issue.id}
                  id={issue.id}
                  data={issue}
                  orgId={params.orgId}
                  statsPeriod={this.props.statsPeriod}
                  showActions={this.props.showActions}
                />
              );
            })}
          </PanelBody>
        </Panel>
      );
    } else body = (this.props.renderEmpty || this.renderEmpty)();

    return body;
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  renderEmpty() {
    const {emptyText} = this.props;

    return (
      <Panel>
        <EmptyMessage icon="icon-circle-exclamation">
          {emptyText ? emptyText : t('Nothing to show here, move along.')}
        </EmptyMessage>
      </Panel>
    );
  },

  render() {
    return (
      <React.Fragment>
        {this.renderResults()}
        {this.props.pagination &&
          this.state.pageLinks && (
            <Pagination pageLinks={this.state.pageLinks} {...this.props} />
          )}
      </React.Fragment>
    );
  },
});

export default IssueList;
