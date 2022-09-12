import {Fragment} from 'react';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';
import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';

interface FlamegraphViewSelectMenuProps {
  onSortingChange: (sorting: FlamegraphViewSelectMenuProps['sorting']) => void;
  onViewChange: (view: FlamegraphViewSelectMenuProps['view']) => void;
  sorting: FlamegraphPreferences['sorting'];
  view: FlamegraphPreferences['view'];
}

function FlamegraphViewSelectMenu({
  view,
  onViewChange,
  sorting,
  onSortingChange,
}: FlamegraphViewSelectMenuProps): React.ReactElement {
  return (
    <Fragment>
      <ButtonBar merged active={sorting}>
        <Button
          barId="call order"
          size="xs"
          onClick={() => onSortingChange('call order')}
        >
          {t('Call Order')}
        </Button>
        <Button
          barId="left heavy"
          size="xs"
          onClick={() => onSortingChange('left heavy')}
        >
          {t('Left Heavy')}
        </Button>
      </ButtonBar>
      <ButtonBar merged active={view}>
        <Button barId="bottom up" size="xs" onClick={() => onViewChange('bottom up')}>
          {t('Bottom Up')}
        </Button>
        <Button barId="top down" size="xs" onClick={() => onViewChange('top down')}>
          {t('Top Down')}
        </Button>
      </ButtonBar>
    </Fragment>
  );
}

export {FlamegraphViewSelectMenu};
