import React from 'react';
import omit from 'lodash/omit';
import xor from 'lodash/xor';
import {Link, withRouter} from 'react-router';
import {WithRouterProps} from 'react-router/lib/withRouter';

import {t} from 'app/locale';

type Props = WithRouterProps;

class GroupEventAttachmentsFilter extends React.Component<Props> {
  render() {
    const {query, pathname} = this.props.location;
    const {types} = query;
    const onlyCrashReportTypes = ['event.minidump', 'event.applecrashreport'];
    const allAttachmentsQuery = omit(query, 'types');
    const onlyCrashReportsQuery = {
      ...query,
      types: onlyCrashReportTypes,
    };

    return (
      <div className="text-right">
        <div className="btn-group" style={{marginBottom: '20px'}}>
          <Link
            to={{pathname, query: allAttachmentsQuery}}
            className={'btn btn-sm btn-default' + (types === undefined ? ' active' : '')}
          >
            {t('All Attachments')}
          </Link>
          <Link
            to={{pathname, query: onlyCrashReportsQuery}}
            className={
              'btn btn-sm btn-default' +
              (xor(onlyCrashReportTypes, types).length === 0 ? ' active' : '')
            }
          >
            {t('Only Crash Reports')}
          </Link>
        </div>
      </div>
    );
  }
}

export default withRouter(GroupEventAttachmentsFilter);
