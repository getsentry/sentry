import {useEffect} from 'react';
import {observer} from 'mobx-react-lite';

import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import type {BreachedMetricInvestigationStore} from 'sentry/views/issueList/pages/breachedMetricInvestigationStore';

type Props = {
  groupId: string;
  store: BreachedMetricInvestigationStore;
};

export const BreachedMetricInvestigationAction = observer(function Action({
  groupId,
  store,
}: Props) {
  useEffect(() => store.register(groupId), [groupId, store]);

  const action = store.actionFor(groupId);
  if (!action) {
    return null;
  }
  return (
    <Button
      size="xs"
      variant={action.kind === 'investigate' ? 'primary' : 'secondary'}
      busy={action.busy}
      disabled={action.busy}
      onClick={event => {
        event.stopPropagation();
        void store.launch(groupId);
      }}
    >
      {action.kind === 'view' ? t('View investigation') : t('Investigate')}
    </Button>
  );
});
