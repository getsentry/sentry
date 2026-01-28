import {useCallback} from 'react';

import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useReplaySaveQuery} from 'sentry/views/explore/hooks/useSaveQuery';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function SaveReplayQueryButton() {
  const organization = useOrganization();
  const {saveQuery} = useReplaySaveQuery();

  const handleClick = useCallback(() => {
    openSaveQueryModal({
      organization,
      saveQuery,
      traceItemDataset: TraceItemDataset.REPLAYS,
    });
  }, [organization, saveQuery]);

  return <Button onClick={handleClick}>{t('Save as')}</Button>;
}
