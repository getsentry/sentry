import React from 'react';
import {Link} from 'react-router';
import PropTypes from 'prop-types';
import omit from 'lodash/omit';
import {t} from 'app/locale';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody} from 'app/components/panels';
import PageHeading from 'app/components/pageHeading';

export default class UserFeedbackContainer extends React.Component {
  static propTypes = {
    location: PropTypes.object.isRequired,
    pageLinks: PropTypes.string,
    status: PropTypes.string.isRequired,
  };

  render() {
    const {location, pageLinks, children, status} = this.props;
    const {pathname, query} = location;

    const unresolvedQuery = omit(query, 'status');
    const allIssuesQuery = {...query, status: ''};

    return (
      <div data-test-id="user-feedback">
        <div className="row">
          <div className="col-sm-9" style={{marginBottom: '5px'}}>
            <PageHeading withMargins>{t('User Feedback')}</PageHeading>
          </div>
          <div className="col-sm-3" style={{textAlign: 'right', marginTop: '4px'}}>
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
