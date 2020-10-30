import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {Panel, PanelBody} from 'app/components/panels';
import withApi from 'app/utils/withApi';
import CompactIssue from 'app/components/issues/compactIssue';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {IconSearch} from 'app/icons';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import space from 'app/styles/space';
import {t} from 'app/locale';

const IssueList = createReactClass({
  displayName: 'IssueList',

  propTypes: {
    api: PropTypes.object,
    endpoint: PropTypes.string.isRequired,
    emptyText: PropTypes.string,
    query: PropTypes.object,
    pagination: PropTypes.bool,
    renderEmpty: PropTypes.func,
    statsPeriod: PropTypes.string,
    showActions: PropTypes.bool,
    noBorder: PropTypes.bool,
    noMargin: PropTypes.bool,
  },

  getDefaultProps() {
    return {
      pagination: true,
      query: {},
      noBorder: false,
      noMargin: false,
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
    const location = this.props.location;
    const nextLocation = nextProps.location;
    if (!location) {
      return;
    }

    if (
      location.pathname !== nextLocation.pathname ||
      location.search !== nextLocation.search
    ) {
      this.remountComponent();
    }
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData() {
    const location = this.props.location;
    this.props.api.clear();
    this.props.api.request(this.props.endpoint, {
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
    const {noBorder, noMargin} = this.props;

    if (this.state.loading) {
      body = this.renderLoading();
    } else if (this.state.error) {
      body = this.renderError();
    } else if (this.state.issueIds.length > 0) {
      const panelStyle = noBorder ? {border: 0, borderRadius: 0} : {};
      if (noMargin) {
        panelStyle.marginBottom = 0;
      }

      body = (
        <Panel style={panelStyle}>
          <PanelBody className="issue-list">
            {this.state.data.map(issue => (
              <CompactIssue
                key={issue.id}
                id={issue.id}
                data={issue}
                statsPeriod={this.props.statsPeriod}
                showActions={this.props.showActions}
              />
            ))}
          </PanelBody>
        </Panel>
      );
    } else {
      body = (this.props.renderEmpty || this.renderEmpty)();
    }

    return body;
  },

  renderError() {
    return (
      <div style={{margin: `${space(2)} ${space(2)} 0`}}>
        <LoadingError onRetry={this.fetchData} />
      </div>
    );
  },

  renderLoading() {
    return (
      <div style={{margin: '18px 18px 0'}}>
        <LoadingIndicator />
      </div>
    );
  },

  renderEmpty() {
    const {emptyText} = this.props;
    const {noBorder, noMargin} = this.props;
    const panelStyle = noBorder ? {border: 0, borderRadius: 0} : {};
    if (noMargin) {
      panelStyle.marginBottom = 0;
    }

    return (
      <Panel style={panelStyle}>
        <EmptyMessage icon={<IconSearch size="xl" />}>
          {emptyText ? emptyText : t('Nothing to show here, move along.')}
        </EmptyMessage>
      </Panel>
    );
  },

  render() {
    return (
      <React.Fragment>
        {this.renderResults()}
        {this.props.pagination && this.state.pageLinks && (
          <Pagination pageLinks={this.state.pageLinks} {...this.props} />
        )}
      </React.Fragment>
    );
  },
});

export {IssueList};

export default withApi(IssueList);
