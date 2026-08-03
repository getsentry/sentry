import styled from '@emotion/styled';
import {observer} from 'mobx-react-lite';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {useTeams} from 'sentry/utils/useTeams';
import type {NotebookStore} from 'sentry/views/seerNotebook/stores/notebookStore';

type Props = {
  onArchive: () => void;
  store: NotebookStore;
};

export const InvestigationSettings = observer(function InvestigationSettings({
  store,
  onArchive,
}: Props) {
  return (
    <SettingsSurface>
      {store.permissions.canManage ? (
        <SettingsRow>
          <Stack gap="xs">
            <Text bold>{t('Access')}</Text>
            <Text size="sm" variant="muted">
              {t('Choose who can edit this investigation.')}
            </Text>
          </Stack>
          <AccessSettings store={store} />
        </SettingsRow>
      ) : null}
      {store.permissions.canManage ? (
        <SettingsRow>
          <Stack gap="xs">
            <Text bold>{t('Archive')}</Text>
            <Text size="sm" variant="muted">
              {t('Preserve this investigation and make it read-only.')}
            </Text>
          </Stack>
          {store.status === 'active' ? (
            <Button variant="danger" onClick={onArchive}>
              {t('Archive investigation')}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void store.restoreInvestigation()}>
              {t('Restore investigation')}
            </Button>
          )}
        </SettingsRow>
      ) : null}
    </SettingsSurface>
  );
});

const AccessSettings = observer(function AccessSettings({store}: {store: NotebookStore}) {
  const permissions = store.permissions;
  const mode = permissions.isEditableByEveryone ? 'everyone' : 'restricted';
  const teamIds = permissions.teamIds;
  const {teams} = useTeams();
  const teamOptions = teams.map(team => ({
    label: `#${team.slug}`,
    value: Number(team.id),
  }));

  const save = (nextMode: 'everyone' | 'restricted', nextTeamIds: number[]) =>
    store
      .updateAccess({
        isEditableByEveryone: nextMode === 'everyone',
        teamIds: nextMode === 'everyone' ? [] : nextTeamIds,
      })
      .catch(() => addErrorMessage(t('The access settings could not be saved.')));

  return (
    <AccessControl>
      <SegmentedControl
        aria-label={t('Who can edit')}
        value={mode}
        disabled={store.isUpdatingAccess}
        onChange={nextMode => {
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
          disabled={store.isUpdatingAccess}
          onChange={selected => {
            const nextTeamIds = selected.map(option => option.value);
            void save('restricted', nextTeamIds);
          }}
        />
      ) : null}
    </AccessControl>
  );
});

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
