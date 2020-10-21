import omit from 'lodash/omit';
import xor from 'lodash/xor';
import {withRouter} from 'react-router';
import {WithRouterProps} from 'react-router/lib/withRouter';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t} from 'app/locale';
import ButtonBar from 'app/components/buttonBar';
import Button from 'app/components/button';

const crashReportTypes = ['event.minidump', 'event.applecrashreport'];

const GroupEventAttachmentsFilter = (props: WithRouterProps) => {
  const {query, pathname} = props.location;
  const {types} = query;
  const allAttachmentsQuery = omit(query, 'types');
  const onlyCrashReportsQuery = {
    ...query,
    types: crashReportTypes,
  };

  let activeButton = '';

  if (types === undefined) {
    activeButton = 'all';
  } else if (xor(crashReportTypes, types).length === 0) {
    activeButton = 'onlyCrash';
  }

  return (
    <FilterWrapper>
      <ButtonBar merged active={activeButton}>
        <Button barId="all" size="small" to={{pathname, query: allAttachmentsQuery}}>
          {t('All Attachments')}
        </Button>
        <Button
          barId="onlyCrash"
          size="small"
          to={{pathname, query: onlyCrashReportsQuery}}
        >
          {t('Only Crash Reports')}
        </Button>
      </ButtonBar>
    </FilterWrapper>
  );
};

const FilterWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-bottom: ${space(3)};
`;

export {crashReportTypes};
export default withRouter(GroupEventAttachmentsFilter);
