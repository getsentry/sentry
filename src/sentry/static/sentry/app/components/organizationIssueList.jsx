import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';
import styled from 'react-emotion';

import GroupStore from 'app/stores/groupStore';
import IssueList from 'app/components/issueList';
import PageHeader from 'app/components/pageHeader';
import space from 'app/styles/space';
import OrganizationHomeContainer from 'app/components/organizations/homeContainer';
import {t} from 'app/locale';

class OrganizationIssueList extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    endpoint: PropTypes.string.isRequired,
    emptyText: PropTypes.string,
    pageSize: PropTypes.number,
  };

  constructor(props) {
    super(props);
    this.state = this.getQueryStringState(props);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.location.search !== this.props.location.search) {
      this.setState(this.getQueryStringState(nextProps), this.fetchData);
    }
  }

  componentWillUnmount() {
    GroupStore.reset();
  }

  getQueryStringState = props => {
    let query = props.location.query;
    let status = 'status' in query ? query.status : 'unresolved';
    return {
      status,
    };
  };

  render() {
    let path = this.props.location.pathname;
    let {status} = this.state;
    return (
      <OrganizationHomeContainer>
        <div className="pull-right">
          <div className="btn-group">
            <Link
              to={path}
              className={
                'btn btn-sm btn-default' + (status === 'unresolved' ? ' active' : '')
              }
            >
              {t('Unresolved')}
            </Link>
            <Link
              to={{pathname: path, query: {status: ''}}}
              className={'btn btn-sm btn-default' + (status === '' ? ' active' : '')}
            >
              {t('All Issues')}
            </Link>
          </div>
        </div>
        <StyledPageHeader withPadding>{this.props.title}</StyledPageHeader>
        <IssueList
          endpoint={this.props.endpoint}
          emptyText={this.props.emptyText}
          query={{
            status: this.state.status,
            statsPeriod: '24h',
            per_page: this.props.pageSize || 25,
          }}
          statsPeriod="24h"
          {...this.props}
        />
      </OrganizationHomeContainer>
    );
  }
}

const StyledPageHeader = styled(PageHeader)`
  margin-bottom: ${space(3)};
  margin-top: ${space(0.5)};
`;

export default OrganizationIssueList;
