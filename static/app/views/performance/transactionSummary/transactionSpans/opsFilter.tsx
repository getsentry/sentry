import styled from '@emotion/styled';
import type {Location} from 'history';

import {CompactSelect} from 'sentry/components/compactSelect';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {IconFilter, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
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

function getMenuOptions({spanOps, isLoading, error}: any) {
  if (isLoading) {
    return [{value: 'isLoading', disabled: true, label: t('Loading…')}];
  }

  if (error) {
    return [
      {
        value: 'error',
        disabled: true,
        label: t('Error loading operations'),
        leadingItems: <IconWarning color="subText" />,
      },
    ];
  }

  return spanOps.map((spanOp: any) => ({
    value: spanOp.op,
    label: spanOp.op,
    leadingItems: <OperationDot backgroundColor={pickBarColor(spanOp.op)} />,
  }));
}

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
    <SpanOpsQuery
      location={location}
      orgSlug={organization.slug}
      eventView={opsFilterEventView}
      cursor="0:0:1"
      noPagination
    >
      {results => (
        <CompactSelect
          clearable
          maxMenuWidth="24rem"
          disallowEmptySelection={false}
          menuTitle={t('Filter by operation')}
          options={getMenuOptions(results)}
          onChange={opt => handleOpChange(opt?.value)}
          value={currentOp}
          triggerLabel={currentOp ?? t('Filter')}
          triggerProps={{icon: <IconFilter />}}
        />
      )}
    </SpanOpsQuery>
  );
}

const OperationDot = styled('div')<{backgroundColor: string}>`
  display: block;
  width: ${space(1)};
  height: ${space(1)};
  border-radius: 100%;
  background-color: ${p => p.backgroundColor};
`;
