import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import DropdownButton from 'sentry/components/dropdownButton';
import DropdownControl from 'sentry/components/dropdownControl';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import Radio from 'sentry/components/radio';
import {IconFilter, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import SpanOpsQuery from 'sentry/utils/performance/suspectSpans/spanOpsQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

type Props = {
  eventView: EventView;
  handleOpChange: (op: string | undefined) => void;
  location: Location;
  organization: Organization;
  transactionName: string;
};

export default function OpsFilter(props: Props) {
  const {location, eventView, organization, handleOpChange, transactionName} = props;

  // clear out the query string from the event view
  // as we want to restrict queries to the op names
  const conditions = new MutableSearch('');
  conditions
    .setFilterValues('event.type', ['transaction'])
    .setFilterValues('transaction', [transactionName]);
  const opsFilterEventView = eventView.clone();
  opsFilterEventView.query = conditions.formatString();

  const currentOp = decodeScalar(location.query.spanOp);

  return (
    <DropdownControl
      menuWidth="240px"
      blendWithActor
      button={({isOpen, getActorProps}) => (
        <DropdownButton
          data-test-id="ops-filter-button"
          {...getActorProps()}
          showChevron={false}
          isOpen={isOpen}
        >
          <Fragment>
            <IconFilter />
            <FilterLabel>
              {defined(currentOp) ? tct('Filter - [op]', {op: currentOp}) : t('Filter')}
            </FilterLabel>
          </Fragment>
        </DropdownButton>
      )}
    >
      <List>
        <ListHeader
          data-test-id="span-op-filter-header"
          onClick={event => {
            event.stopPropagation();
            handleOpChange(undefined);
          }}
        >
          <HeaderTitle>{t('All Operations')}</HeaderTitle>
          <Radio radioSize="small" checked={!defined(currentOp)} onChange={() => {}} />
        </ListHeader>
        <SpanOpsQuery
          location={location}
          orgSlug={organization.slug}
          eventView={opsFilterEventView}
          cursor="0:0:1"
          noPagination
        >
          {({spanOps, isLoading, error}) => {
            if (isLoading) {
              return <StyledLoadingIndicator />;
            }

            if (error) {
              return (
                <ErrorPanel height="124px">
                  <IconWarning color="gray300" size="lg" />
                </ErrorPanel>
              );
            }

            if (!defined(spanOps) || spanOps.length === 0) {
              return <EmptyStateWarning small>{t('No span ops')}</EmptyStateWarning>;
            }

            return spanOps.map(spanOp => (
              <ListItem
                data-test-id="span-op-filter-item"
                key={spanOp.op}
                onClick={event => {
                  event.stopPropagation();
                  handleOpChange(spanOp.op);
                }}
              >
                <OperationDot backgroundColor={pickBarColor(spanOp.op)} />
                <OperationName>{spanOp.op}</OperationName>
                <Radio
                  radioSize="small"
                  checked={spanOp.op === currentOp}
                  onChange={() => {}}
                />
              </ListItem>
            ));
          }}
        </SpanOpsQuery>
      </List>
    </DropdownControl>
  );
}

const FilterLabel = styled('span')`
  margin-left: ${space(1)};
  white-space: nowrap;
`;

const List = styled('ul')`
  max-height: 250px;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
`;

const ListHeader = styled('li')`
  display: grid;
  grid-template-columns: auto min-content;
  grid-column-gap: ${space(1)};
  align-items: center;

  margin: 0;
  background-color: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.gray300};
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const HeaderTitle = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const ListItem = styled('li')`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  grid-column-gap: ${space(1)};
  align-items: center;
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  :hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  &:hover span {
    color: ${p => p.theme.blue300};
    text-decoration: underline;
  }
`;

const OperationDot = styled('div')<{backgroundColor: string}>`
  content: '';
  display: block;
  width: 8px;
  min-width: 8px;
  height: 8px;
  margin-right: ${space(1)};
  border-radius: 100%;

  background-color: ${p => p.backgroundColor};
`;

const OperationName = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
  ${overflowEllipsis};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: ${space(4)} auto;
`;
