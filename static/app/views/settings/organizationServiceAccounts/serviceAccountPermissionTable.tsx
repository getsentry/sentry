import {Stack} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tn} from 'sentry/locale';
import {
  getPermissionLevel,
  PERMISSIONS,
} from 'sentry/views/seerWorkflows/automations/serviceAccountAccess';

const COLUMNS: TableColumnConfig[] = [
  {key: 'resource', width: 'minmax(0, 1fr)'},
  {key: 'access', width: 'auto'},
];

export function getPermissionCount(scopes: string[]) {
  const selected = new Set(scopes);
  return PERMISSIONS.filter(
    permission => getPermissionLevel(permission, selected) !== 'no-access'
  ).length;
}

export function PermissionCount({scopes}: {scopes: string[]}) {
  return <Text>{tn('%s permission', '%s permissions', getPermissionCount(scopes))}</Text>;
}

/**
 * A read-only view of the resource levels the Seer automation form's
 * `ServiceAccountPermissions` picker sets.
 */
export function ServiceAccountPermissionTable({scopes}: {scopes: string[]}) {
  const selected = new Set(scopes);
  return (
    <SimpleTable
      columns={COLUMNS}
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Resource')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Access')}</SimpleTable.HeaderCell>
        </SimpleTable.HeaderRow>
      }
    >
      {PERMISSIONS.map(permission => {
        const level = getPermissionLevel(permission, selected);
        return (
          <SimpleTable.Row key={permission.resource}>
            <SimpleTable.RowCell>
              <Stack gap="xs">
                <Text bold>{permission.label ?? permission.resource}</Text>
                <Text size="sm" variant="muted">
                  {permission.help}
                </Text>
              </Stack>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell justify="end">
              <Text variant={level === 'no-access' ? 'muted' : 'primary'}>
                {Object.entries(permission.choices).find(
                  ([choiceLevel]) => choiceLevel === level
                )?.[1].label ?? t('No Access')}
              </Text>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        );
      })}
    </SimpleTable>
  );
}
