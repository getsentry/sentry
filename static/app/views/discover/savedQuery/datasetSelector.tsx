import omit from 'lodash/omit';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import type {SavedQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {DEFAULT_EVENT_VIEW_MAP} from 'sentry/views/discover/data';
import {getDataset} from 'sentry/views/discover/savedQuery/utils';

export const DATASET_PARAM = 'queryDataset';

type Props = {
  isHomepage: boolean | undefined;
  savedQuery: SavedQuery | undefined;
  splitDecision?: string;
};

export function DatasetSelector(props: Props) {
  const {savedQuery, isHomepage, splitDecision} = props;
  const location = useLocation();
  const organization = useOrganization();
  const navigate = useNavigate();

  const value = getDataset(location, savedQuery, splitDecision);

  const options = [
    {value: 'error-events', label: t('Errors')},
    {value: 'transaction-like', label: t('Transactions')},
  ];

  if (value === 'discover') {
    options.push({value: 'discover', label: t('Unknown')});
  }

  return (
    <CompactSelect
      triggerProps={{prefix: t('Dataset')}}
      value={value}
      options={options}
      onChange={newValue => {
        const query = DEFAULT_EVENT_VIEW_MAP[newValue.value];
        const newQuery = savedQuery
          ? omit(query, ['name', 'id', 'projects', 'range'])
          : query;
        const nextEventView = EventView.fromNewQueryWithLocation(newQuery, location);
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
