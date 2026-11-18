import {Stack} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';

import {
  getCategoryResources,
  getGrantedScopes,
  SCOPE_CATEGORIES,
  type Bundle,
  type ScopeResource,
} from './serviceAccountData';

export type AccessLevel = 'none' | 'read' | 'write';

/** Write includes Read, like Stripe restricted keys and GitHub fine-grained tokens. */
export function getResourceLevel(bundle: Bundle, resource: ScopeResource): AccessLevel {
  const granted = getGrantedScopes(bundle, resource);
  if (granted.some(scope => scope.action !== 'read')) {
    return 'write';
  }
  return granted.length > 0 ? 'read' : 'none';
}

const ALL_RESOURCES = SCOPE_CATEGORIES.flatMap(category =>
  getCategoryResources(category.id)
);

const COLUMNS: TableColumnConfig[] = [
  {key: 'resource', width: 'minmax(0, 1fr)'},
  {key: 'access', width: 'auto'},
];

function getLevelLabel(resource: ScopeResource, level: AccessLevel) {
  if (level === 'none') {
    return t('No Access');
  }
  if (level === 'read') {
    return t('Read');
  }
  return resource.scopes.some(scope => scope.action === 'read')
    ? t('Read & Write')
    : t('Write');
}

/**
 * A read-only table of what a bundle grants, one row per resource. Matches the
 * permission table on the Seer automation form (`seerWorkflows/automations/
 * serviceAccountAccess.tsx`), with the level as text instead of a dropdown.
 */
export function PermissionTable({bundle}: {bundle: Bundle}) {
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
      {ALL_RESOURCES.map(resource => {
        const level = getResourceLevel(bundle, resource);
        return (
          <SimpleTable.Row key={resource.id}>
            <SimpleTable.RowCell>
              <Stack gap="xs">
                <Text bold>{resource.label}</Text>
                <Text size="sm" variant="muted">
                  {resource.help}
                </Text>
              </Stack>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell justify="end">
              <Text variant={level === 'none' ? 'muted' : 'primary'}>
                {getLevelLabel(resource, level)}
              </Text>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        );
      })}
    </SimpleTable>
  );
}

/** e.g. "Read 23 · Write 5 · 2 irreversible · 1 cost impacting" */
export function PermissionSummary({bundle}: {bundle: Bundle}) {
  const written = ALL_RESOURCES.map(resource =>
    getGrantedScopes(bundle, resource).filter(scope => scope.action !== 'read')
  ).filter(scopes => scopes.length > 0);
  const readable = ALL_RESOURCES.filter(
    resource => getResourceLevel(bundle, resource) !== 'none'
  );
  return (
    <Text size="sm" variant="muted">
      {t(
        'Read %s · Write %s · %s irreversible · %s cost impacting',
        readable.length,
        written.length,
        written.filter(scopes => scopes.some(scope => scope.irreversible)).length,
        written.filter(scopes => scopes.some(scope => scope.costImpact)).length
      )}
    </Text>
  );
}
