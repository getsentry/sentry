import {Button} from '@sentry/scraps/button';

import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useReplaySaveQuery} from 'sentry/views/explore/hooks/useSaveQuery';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function SaveReplayQueryButton() {
  const organization = useOrganization();
  const {saveQuery} = useReplaySaveQuery();

  const handleClick = () => {
    openSaveQueryModal({
      organization,
      saveQuery,
      traceItemDataset: TraceItemDataset.REPLAYS,
    });
  };

  return <Button onClick={handleClick}>{t('Save as')}</Button>;
}
