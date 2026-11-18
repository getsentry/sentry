import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';

import {
  getCategoryResources,
  getGrantedScopes,
  isLimitedByDataAccess,
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

function WriteNotes({bundle, resource}: {bundle: Bundle; resource: ScopeResource}) {
  const written = getGrantedScopes(bundle, resource).filter(
    scope => scope.action !== 'read'
  );
  if (written.length === 0) {
    return null;
  }
  const ownDataOnly =
    bundle.dataAccess === 'own' &&
    !resource.ownerless &&
    written.some(isLimitedByDataAccess);
  return (
    <Fragment>
      {ownDataOnly && <Tag variant="muted">{t('Own data only')}</Tag>}
      {written.some(scope => scope.irreversible) && (
        <Tag variant="danger">{t('Irreversible')}</Tag>
      )}
      {written.some(scope => scope.costImpact) && (
        <Tag variant="warning">{t('Cost impact')}</Tag>
      )}
    </Fragment>
  );
}

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
 * A read-only table of what a bundle grants: one row per resource, grouped by category.
 * Follows the permission table on the Seer automation form (`seerWorkflows/automations/
 * serviceAccountAccess.tsx`), using the proposed granular scopes instead.
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
      {SCOPE_CATEGORIES.map(category => (
        <Fragment key={category.id}>
          <SimpleTable.Row>
            <SimpleTable.RowCell column="1 / -1" background="secondary" gap="sm">
              <Text bold uppercase size="xs">
                {category.label}
              </Text>
              <Text size="xs" variant="muted">
                {category.appliesTo === 'projects'
                  ? t('Applies to the selected projects')
                  : t('Applies to the whole organization')}
              </Text>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
          {getCategoryResources(category.id).map(resource => {
            const level = getResourceLevel(bundle, resource);
            return (
              <SimpleTable.Row key={resource.id}>
                <SimpleTable.RowCell>
                  <Stack gap="xs">
                    <Flex gap="sm" align="center" wrap="wrap">
                      <Text bold>{resource.label}</Text>
                      <WriteNotes bundle={bundle} resource={resource} />
                    </Flex>
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
        </Fragment>
      ))}
    </SimpleTable>
  );
}

const ALL_RESOURCES = SCOPE_CATEGORIES.flatMap(category =>
  getCategoryResources(category.id)
);

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
