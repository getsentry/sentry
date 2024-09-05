import {TabList, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import type {SavedQuery} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
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
    <Tabs
      value={value}
      onChange={newValue => {
        const nextEventView = eventView.withDataset(
          getDatasetFromLocationOrSavedQueryDataset(undefined, newValue)
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
          },
        });
      }}
    >
      <TabList variant="filled" hideBorder>
        {options.map(option => (
          <TabList.Item key={option.value}>{option.label}</TabList.Item>
        ))}
      </TabList>
    </Tabs>
  );
}
