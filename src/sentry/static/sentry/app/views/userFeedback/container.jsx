import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import space from 'app/styles/space';
import {t} from 'app/locale';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody} from 'app/components/panels';
import PageHeading from 'app/components/pageHeading';

import {Link} from 'react-router';

export default class UserFeedbackContainer extends React.Component {
  static propTypes = {
    location: PropTypes.object.isRequired,
    pageLinks: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
  };

  render() {
    const {location: {pathname}, pageLinks, children, status} = this.props;

    return (
      <div>
        <div className="row">
          <div className="col-sm-9">
            <StyledPageHeading>{t('User Feedback')}</StyledPageHeading>
          </div>
          <div className="col-sm-3" style={{textAlign: 'right'}}>
            <div className="btn-group">
              <Link
                to={pathname}
                className={
                  'btn btn-sm btn-default' + (status === 'unresolved' ? ' active' : '')
                }
              >
                {t('Unresolved')}
              </Link>
              <Link
                to={{pathname, query: {status: ''}}}
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

const StyledPageHeading = styled(PageHeading)`
  margin-top: ${space(1)};
  margin-bottom: ${space(3)};
`;
