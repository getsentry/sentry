import React from 'react';
import omit from 'lodash/omit';
import xor from 'lodash/xor';
import {withRouter} from 'react-router';
import {WithRouterProps} from 'react-router/lib/withRouter';
import styled from 'react-emotion';

import space from 'app/styles/space';
import {t} from 'app/locale';
import ButtonBar from 'app/components/buttonBar';
import Button from 'app/components/button';

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
      <MergedButtonBar>
        <Button
          size="small"
          to={{pathname, query: allAttachmentsQuery}}
          priority={types === undefined ? 'primary' : 'default'}
        >
          {t('All Attachments')}
        </Button>
        <Button
          size="small"
          to={{pathname, query: onlyCrashReportsQuery}}
          priority={xor(onlyCrashReportTypes, types).length === 0 ? 'primary' : 'default'}
        >
          {t('Only Crash Reports')}
        </Button>
      </MergedButtonBar>
    </FilterWrapper>
  );
};

const FilterWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-bottom: ${space(3)};
`;

const MergedButtonBar = styled(ButtonBar)`
  & > a:first-child:not(:last-child) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  & > a:last-child:not(:first-child) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
`;

export default withRouter(GroupEventAttachmentsFilter);
