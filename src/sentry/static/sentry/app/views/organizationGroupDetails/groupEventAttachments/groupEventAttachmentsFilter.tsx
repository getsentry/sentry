import React from 'react';
import omit from 'lodash/omit';
import xor from 'lodash/xor';
import {Link, withRouter} from 'react-router';
import {WithRouterProps} from 'react-router/lib/withRouter';
import styled from 'react-emotion';

import space from 'app/styles/space';
import {t} from 'app/locale';

const GroupEventAttachmentsFilter = (props: WithRouterProps) => {
  const {query, pathname} = props.location;
  const {types} = query;
  const onlyCrashReportTypes = ['event.minidump', 'event.applecrashreport'];
  const allAttachmentsQuery = omit(query, 'types');
  const onlyCrashReportsQuery = {
    ...query,
    types: onlyCrashReportTypes,
  };

  return (
    <FilterWrapper>
      <div className="btn-group">
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
    </FilterWrapper>
  );
};

const FilterWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-bottom: ${space(3)};
`;

export default withRouter(GroupEventAttachmentsFilter);
