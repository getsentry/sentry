import React from 'react';
import {Link} from 'react-router';
import styled from 'react-emotion';
import PropTypes from 'prop-types';
import {omit} from 'lodash';
import {t} from 'app/locale';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody} from 'app/components/panels';

export default class UserFeedbackContainer extends React.Component {
  static propTypes = {
    location: PropTypes.object.isRequired,
    params: PropTypes.object.isRequired,
    pageLinks: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
  };

  render() {
    const {location: {pathname, query}, params, pageLinks, children, status} = this.props;

    const unresolvedQuery = omit(query, 'status');
    const allIssuesQuery = {...query, status: ''};

    return (
      <div>
        <div className="row release-list-header">
          <div className="col-sm-9">
            {params.projectId ? (
              <h3>{t('User Feedback')}</h3>
            ) : (
              <Header>{t('User Feedback')}</Header>
            )}
          </div>
          <div className="col-sm-3" style={{textAlign: 'right'}}>
            <div className="btn-group">
              <Link
                to={{pathname, query: unresolvedQuery}}
                className={
                  'btn btn-sm btn-default' + (status === 'unresolved' ? ' active' : '')
                }
              >
                {t('Unresolved')}
              </Link>
              <Link
                to={{pathname, query: allIssuesQuery}}
                className={'btn btn-sm btn-default' + (status === '' ? ' active' : '')}
              >
                {t('All Issues')}
              </Link>
            </div>
          </div>
        </div>
        <Panel>
          <PanelBody className="issue-list">{children}</PanelBody>
        </Panel>
        <Pagination pageLinks={pageLinks} />
      </div>
    );
  }
}

const Header = styled('h4')`
  font-weight: normal;
`;
