import omit from 'lodash/omit';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import type {Organization, SavedQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {DEFAULT_EVENT_VIEW_MAP} from 'sentry/views/discover/data';

export const DATASET_PARAM = 'queryDataset';

type Props = {
  isHomepage: boolean | undefined;
  organization: Organization;
  savedQuery: SavedQuery | undefined;
};

export function DatasetSelector(props: Props) {
  const {organization, savedQuery, isHomepage} = props;
  const location = useLocation();
  const navigate = useNavigate();
  const value = decodeScalar(location.query[DATASET_PARAM]) ?? 'errors';

  const options = [
    {value: 'errors', label: t('Errors')},
    {value: 'transaction-like', label: t('Transactions')},
  ];

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
