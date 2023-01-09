import {Fragment, useCallback} from 'react';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';
import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';

export interface FlamegraphViewSelectMenuProps {
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
  const onCallOrderClick = useCallback(() => {
    onSortingChange('call order');
  }, [onSortingChange]);

  const onLeftHeavyClick = useCallback(() => {
    onSortingChange('left heavy');
  }, [onSortingChange]);

  const onBottomUpClick = useCallback(() => {
    onViewChange('bottom up');
  }, [onViewChange]);

  const onTopDownClick = useCallback(() => {
    onViewChange('top down');
  }, [onViewChange]);

  return (
    <Fragment>
      <ButtonBar merged active={sorting}>
        <Button barId="call order" size="xs" onClick={onCallOrderClick}>
          {t('Call Order')}
        </Button>
        <Button barId="left heavy" size="xs" onClick={onLeftHeavyClick}>
          {t('Left Heavy')}
        </Button>
      </ButtonBar>
      <ButtonBar merged active={view}>
        <Button barId="bottom up" size="xs" onClick={onBottomUpClick}>
          {t('Bottom Up')}
        </Button>
        <Button barId="top down" size="xs" onClick={onTopDownClick}>
          {t('Top Down')}
        </Button>
      </ButtonBar>
    </Fragment>
  );
}

export {FlamegraphViewSelectMenu};
