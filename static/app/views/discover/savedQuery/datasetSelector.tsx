import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import type {SavedQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {DEFAULT_EVENT_VIEW_MAP} from 'sentry/views/discover/data';
import {getSavedQueryDataset} from 'sentry/views/discover/savedQuery/utils';

export const DATASET_PARAM = 'queryDataset';

type Props = {
  eventView: EventView;
  isHomepage: boolean | undefined;
  savedQuery: SavedQuery | undefined;
  splitDecision?: SavedQueryDatasets;
};

export function DatasetSelector(props: Props) {
  const {savedQuery, isHomepage, splitDecision, eventView} = props;
  const location = useLocation();
  const organization = useOrganization();
  const navigate = useNavigate();

  const value = getSavedQueryDataset(location, savedQuery, splitDecision);

  const options = [
    {value: SavedQueryDatasets.ERRORS, label: t('Errors')},
    {value: SavedQueryDatasets.TRANSACTIONS, label: t('Transactions')},
  ];

  if (value === 'discover') {
    options.push({value: SavedQueryDatasets.DISCOVER, label: t('Unknown')});
  }

  return (
    <CompactSelect
      triggerProps={{prefix: t('Dataset')}}
      value={value}
      options={options}
      onChange={newValue => {
        let nextEventView: EventView;
        if (eventView.id) {
          nextEventView = eventView.withQueryDataset(newValue.value);
        } else {
          const query = DEFAULT_EVENT_VIEW_MAP[newValue.value];
          nextEventView = EventView.fromNewQueryWithLocation(query, location);
        }
        const nextLocation = nextEventView.getResultsViewUrlTarget(
          organization.slug,
          isHomepage
        );
        navigate({
          ...location,
          query: {
            ...nextLocation.query,
            [DATASET_PARAM]: newValue.value,
          },
        });
      }}
      size="sm"
    />
  );
}
