import {useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tn} from 'sentry/locale';
import {useTeams} from 'sentry/utils/useTeams';

import type {InvestigationPermissions} from './types';

type Props = {
  onChange: (permissions: InvestigationPermissions) => Promise<void>;
  permissions: InvestigationPermissions;
};

export function InvestigationAccessSelector({permissions, onChange}: Props) {
  const {teams} = useTeams();
  const [pending, setPending] = useState(false);
  const selected = permissions.isEditableByEveryone
    ? ['_all']
    : permissions.teamIds.map(String);
  const options = [
    {value: '_all', label: t('Everyone in the organization')},
    ...teams.map(team => ({value: team.id, label: `#${team.slug}`})),
  ];

  const selector = (
    <CompactSelect
      multiple
      size="sm"
      value={selected}
      options={options}
      disabled={!permissions.canManage || pending}
      onChange={async nextOptions => {
        let values = nextOptions.map(option => option.value);
        if (!selected.includes('_all') && values.includes('_all')) {
          values = ['_all'];
        } else if (selected.includes('_all') && values.some(value => value !== '_all')) {
          values = values.filter(value => value !== '_all');
        }

        setPending(true);
        try {
          await onChange({
            ...permissions,
            isEditableByEveryone: values.includes('_all'),
            teamIds: values
              .filter(value => value !== '_all')
              .map(Number)
              .sort((a, b) => a - b),
          });
        } finally {
          setPending(false);
        }
      }}
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          variant="transparent"
          style={{padding: 2}}
        >
          {permissions.isEditableByEveryone ? (
            <AllTag variant="info">{t('All')}</AllTag>
          ) : permissions.teamIds.length ? (
            <Text size="sm">{tn('%s team', '%s teams', permissions.teamIds.length)}</Text>
          ) : (
            <Text size="sm">{t('Owner')}</Text>
          )}
        </OverlayTrigger.Button>
      )}
      position="bottom-end"
      strategy="fixed"
    />
  );

  return permissions.canManage ? (
    selector
  ) : (
    <Tooltip title={t('Only the creator or an organization manager can edit access.')}>
      {selector}
    </Tooltip>
  );
}

const AllTag = styled(Tag)`
  min-width: 30px;
  justify-content: center;
`;
