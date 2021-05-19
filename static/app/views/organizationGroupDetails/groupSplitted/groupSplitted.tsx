import {useEffect, useState} from 'react';
import {Location} from 'history';

import GroupingActions from 'app/actions/groupingActions';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import GroupingStore from 'app/stores/groupingStore';
import {Group, Organization} from 'app/types';

import Card from './card';

type Props = {
  organization: Organization;
  groupId: Group['id'];
  location: Location;
};

function GroupSplitted({groupId, location}: Props) {
  const [splittedItems, setSplittedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const listener = GroupingStore.listen(onGroupingChange, undefined);
    fetchData();
    return () => {
      listener();
    };
  }, []);

  function onGroupingChange({mergedItems, loading, error}) {
    setIsLoading(typeof loading !== 'undefined' ? loading : false);
    setHasError(typeof error !== 'undefined' ? error : false);
    setSplittedItems(mergedItems ?? []);
  }

  function fetchData() {
    GroupingActions.fetch([
      {
        endpoint: `/issues/${groupId}/hashes/split/`,
        dataKey: 'merged',
        queryParams: location.query,
      },
    ]);
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (hasError) {
    return (
      <LoadingError
        message={t('Unable to load merged events, please try again later')}
        onRetry={fetchData}
      />
    );
  }

  const fingerprintsWithLatestEvent = splittedItems.filter(
    ({latestEvent}) => !!latestEvent
  );
  const hasResults = fingerprintsWithLatestEvent.length > 0;

  if (!hasResults) {
    return (
      <Panel>
        <EmptyStateWarning>
          <p>{t("There don't seem to be any hashes for this issue.")}</p>
        </EmptyStateWarning>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelBody>
        {fingerprintsWithLatestEvent.map(fingerprint => (
          <Card key={fingerprint.id}>{fingerprint.id}</Card>
        ))}
      </PanelBody>
    </Panel>
  );
}

export default GroupSplitted;
