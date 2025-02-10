import * as Layout from 'sentry/components/layouts/thirds';
import {TabList} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import type {SavedQuery} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
import {
  ERROR_ONLY_FIELDS,
  explodeField,
  getAggregations,
  type QueryFieldValue,
  TRANSACTION_ONLY_FIELDS,
} from 'sentry/utils/discover/fields';
import {DiscoverDatasets, SavedQueryDatasets} from 'sentry/utils/discover/types';
import type {FieldKey, SpanOpBreakdown} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {
  getDatasetFromLocationOrSavedQueryDataset,
  getSavedQueryDataset,
} from 'sentry/views/discover/savedQuery/utils';

export const DATASET_PARAM = 'queryDataset';

export const DATASET_LABEL_MAP = {
  [SavedQueryDatasets.ERRORS]: t('Errors'),
  [SavedQueryDatasets.TRANSACTIONS]: t('Transactions'),
  [SavedQueryDatasets.DISCOVER]: t('Unknown'),
};

type Props = {
  eventView: EventView;
  isHomepage: boolean | undefined;
  savedQuery: SavedQuery | undefined;
  splitDecision?: SavedQueryDatasets;
};

function getValidEventViewForDataset(eventView: EventView, toDataset: DiscoverDatasets) {
  let modifiedQuery: boolean = false;
  let to = eventView.clone();
  const allowedAggregations = Object.keys(getAggregations(toDataset));
  let newColumns: QueryFieldValue[] = [];
  const search = new MutableSearch(eventView.query);
  const denylistedFields =
    toDataset === DiscoverDatasets.ERRORS ? TRANSACTION_ONLY_FIELDS : ERROR_ONLY_FIELDS;

  const removedFields: string[] = [];
  const equationsToCheck: string[] = [];
  eventView.fields.forEach(field => {
    const column = explodeField(field);
    if (
      column.kind === 'field' &&
      denylistedFields.includes(column.field as FieldKey | SpanOpBreakdown)
    ) {
      search.removeFilter(field.field);
      removedFields.push(field.field);
      modifiedQuery = true;
      return;
    }
    if (column.kind === 'function') {
      if (!allowedAggregations.includes(column.function[0])) {
        search.removeFilter(field.field);
        removedFields.push(field.field);
        modifiedQuery = true;
        return;
      }
      if (denylistedFields.includes(column.function[1] as FieldKey | SpanOpBreakdown)) {
        search.removeFilter(field.field);
        removedFields.push(field.field);
        modifiedQuery = true;
        return;
      }
    }
    if (column.kind === 'equation') {
      equationsToCheck.push(field.field);
    }
    newColumns.push(column);
  });

  newColumns = newColumns.filter(column => {
    if (column.kind !== 'equation') {
      return true;
    }
    return removedFields.some(f => !column.field.includes(f));
  });

  const remainingSearchFilter = search.formatString();

  for (const element of denylistedFields) {
    if (remainingSearchFilter.includes(element)) {
      search.removeFilter(element);
      modifiedQuery = true;
    }
  }

  to = to.withColumns(newColumns);
  to.query = search.formatString();
  return {to, modifiedQuery};
}

export function DatasetSelectorTabs(props: Props) {
  const {savedQuery, isHomepage, splitDecision, eventView} = props;
  const location = useLocation();
  const organization = useOrganization();
  const navigate = useNavigate();

  const value = getSavedQueryDataset(organization, location, savedQuery, splitDecision);

  const options = [
    {
      value: SavedQueryDatasets.ERRORS,
      label: DATASET_LABEL_MAP[SavedQueryDatasets.ERRORS],
    },
    {
      value: SavedQueryDatasets.TRANSACTIONS,
      label: DATASET_LABEL_MAP[SavedQueryDatasets.TRANSACTIONS],
    },
  ];

  if (value === 'discover') {
    options.push({
      value: SavedQueryDatasets.DISCOVER,
      label: DATASET_LABEL_MAP[SavedQueryDatasets.DISCOVER],
    });
  }

  return (
    <Layout.HeaderTabs
      value={value}
      onChange={newValue => {
        const {to: nextEventView, modifiedQuery} = getValidEventViewForDataset(
          eventView.withDataset(
            getDatasetFromLocationOrSavedQueryDataset(undefined, newValue)
          ),
          newValue === SavedQueryDatasets.ERRORS
            ? DiscoverDatasets.ERRORS
            : DiscoverDatasets.TRANSACTIONS
        );
        const nextLocation = nextEventView.getResultsViewUrlTarget(
          organization.slug,
          isHomepage
        );
        navigate({
          ...location,
          query: {
            ...nextLocation.query,
            [DATASET_PARAM]: newValue,
            incompatible: modifiedQuery ? modifiedQuery : undefined,
          },
        });
      }}
    >
      <TabList variant="filled" hideBorder>
        {options.map(option => (
          <TabList.Item key={option.value}>{option.label}</TabList.Item>
        ))}
      </TabList>
    </Layout.HeaderTabs>
  );
}
