import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useTeams} from 'sentry/utils/useTeams';

import type {InvestigationDetail, InvestigationPermissions} from './types';

type Props = {
  detail: InvestigationDetail;
  onArchive: () => void;
  onRestore: () => Promise<void>;
  onSavePermissions: (permissions: InvestigationPermissions) => Promise<void>;
};

export function InvestigationSettings({
  detail,
  onArchive,
  onRestore,
  onSavePermissions,
}: Props) {
  return (
    <SettingsSurface>
      {detail.permissions.canManage ? (
        <SettingsRow>
          <Stack gap="xs">
            <Text bold>{t('Access')}</Text>
            <Text size="sm" variant="muted">
              {t('Choose who can edit this investigation.')}
            </Text>
          </Stack>
          <AccessSettings detail={detail} onSave={onSavePermissions} />
        </SettingsRow>
      ) : null}
      {detail.permissions.canManage ? (
        <SettingsRow>
          <Stack gap="xs">
            <Text bold>{t('Archive')}</Text>
            <Text size="sm" variant="muted">
              {t('Preserve this investigation and make it read-only.')}
            </Text>
          </Stack>
          {detail.status === 'active' ? (
            <Button variant="danger" onClick={onArchive}>
              {t('Archive investigation')}
            </Button>
          ) : (
            <Button variant="primary" onClick={onRestore}>
              {t('Restore investigation')}
            </Button>
          )}
        </SettingsRow>
      ) : null}
    </SettingsSurface>
  );
}

function AccessSettings({
  detail,
  onSave,
}: {
  detail: InvestigationDetail;
  onSave: (permissions: InvestigationPermissions) => Promise<void>;
}) {
  const permissions = detail.permissions;
  const [mode, setMode] = useState<'everyone' | 'restricted'>(
    permissions.isEditableByEveryone ? 'everyone' : 'restricted'
  );
  const [teamIds, setTeamIds] = useState(permissions.teamIds);
  const [saving, setSaving] = useState(false);
  const {teams} = useTeams();
  const teamOptions = teams.map(team => ({
    label: `#${team.slug}`,
    value: Number(team.id),
  }));

  const save = async (nextMode: 'everyone' | 'restricted', nextTeamIds: number[]) => {
    setSaving(true);
    try {
      await onSave({
        ...permissions,
        isEditableByEveryone: nextMode === 'everyone',
        teamIds: nextMode === 'everyone' ? [] : nextTeamIds,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccessControl>
      <SegmentedControl
        aria-label={t('Who can edit')}
        value={mode}
        disabled={saving}
        onChange={nextMode => {
          setMode(nextMode);
          if (nextMode === 'everyone') {
            setTeamIds([]);
          }
          void save(nextMode, nextMode === 'everyone' ? [] : teamIds);
        }}
      >
        <SegmentedControl.Item key="everyone">{t('Everyone')}</SegmentedControl.Item>
        <SegmentedControl.Item key="restricted">
          {t('Creator and teams')}
        </SegmentedControl.Item>
      </SegmentedControl>
      {mode === 'restricted' ? (
        <Select
          multiple
          options={teamOptions}
          value={teamIds}
          disabled={saving}
          onChange={selected => {
            const nextTeamIds = selected.map(option => option.value);
            setTeamIds(nextTeamIds);
            void save('restricted', nextTeamIds);
          }}
        />
      ) : null}
    </AccessControl>
  );
}

const SettingsSurface = styled(Stack)`
  gap: 0;
`;

const SettingsRow = styled(Flex)`
  align-items: flex-start;
  justify-content: space-between;
  gap: ${p => p.theme.space['2xl']};
  padding: ${p => p.theme.space.xl} 0;

  & + & {
    border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const AccessControl = styled(Stack)`
  width: 260px;
  align-items: flex-end;
  gap: ${p => p.theme.space.sm};
`;
