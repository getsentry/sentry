import {useCallback} from 'react';

import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useReplaySaveQuery} from 'sentry/views/replays/hooks/useReplaySaveQuery';

interface SaveReplayQueryButtonProps {
  query: string;
}

export function SaveReplayQueryButton({query}: SaveReplayQueryButtonProps) {
  const organization = useOrganization();
  const {saveQuery} = useReplaySaveQuery(query);

  const handleClick = useCallback(() => {
    openSaveQueryModal({
      organization,
      saveQuery,
      traceItemDataset: TraceItemDataset.REPLAYS,
    });
  }, [organization, saveQuery]);

  return <Button onClick={handleClick}>{t('Save as')}</Button>;
}
