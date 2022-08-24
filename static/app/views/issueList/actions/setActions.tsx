import {useEffect, useState} from 'react';

import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';

type SetActionsProps = {
  disabled: boolean;
  onUpdate: (params: any) => void;
  orgSlug: Organization['slug'];
};
function SetActions({disabled, onUpdate, orgSlug}: SetActionsProps) {
  const api = useApi();
  const [issueSets, setIssueSets] = useState([]);
  useEffect(() => {
    api
      .requestPromise(`/organizations/${orgSlug}/issue-sets/`)
      .then(responseIssueSets => setIssueSets(responseIssueSets));
  }, [api, orgSlug]);

  return (
    <DropdownMenuControl
      size="sm"
      triggerLabel={t('Organize')}
      triggerProps={{
        'aria-label': t('Organize'),
        showChevron: true,
        size: 'xs',
      }}
      items={[
        {
          key: 'triage',
          label: 'Temporarily for triage',
          // TODO(Leander): Pop up a modal with the UI
          onAction: () => {},
        },
        {
          key: 'new',
          label: 'Into a new Issue Set',
          // TODO(Leander): Redirect to issue set creation with those issues premade
          onAction: () => {},
        },
        {
          key: 'existing',
          label: 'Into an existing Issue Set',
          isSubmenu: true,
          children: issueSets.map(({id, name}) => ({
            key: id,
            label: name,
            onAction: (issueSetId: string) => onUpdate({issueSetId}),
          })),
        },
      ]}
      isDisabled={disabled}
    />
  );
}

export default SetActions;
