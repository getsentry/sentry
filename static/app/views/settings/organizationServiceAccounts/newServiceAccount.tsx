import {Fragment, useState} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Input} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {FieldGroup} from 'sentry/components/forms/fieldGroup';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {
  ALL_SCOPE_IDS,
  applyGuardrails,
  BUNDLES,
  CUSTOM_BUNDLE_ID,
  DEFAULT_BUNDLE_ID,
  getGrantedScopes,
  GUARDRAILS,
  isLimitedByDataAccess,
  getCategoryResources,
  SCOPE_CATEGORIES,
  SCOPE_RESOURCES,
  type Bundle,
  type DataAccess,
  type Guardrail,
  type GuardrailId,
  type Scope,
  type ScopeCategory,
  type ScopeResource,
} from 'sentry/views/settings/organizationServiceAccounts/serviceAccountData';
import {
  ALL_ACCESS_PROJECTS,
  ServiceAccountProjectSelect,
  useAccessibleProjects,
} from 'sentry/views/settings/organizationServiceAccounts/serviceAccountProjectSelect';

type AccessLevel = 'read' | 'write';

const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  read: t('Read'),
  write: t('Write'),
};

/**
 * The UI only shows Read and Write. Write covers every non-read scope (create, edit,
 * delete, invite, spend); the granular scopes stay underneath.
 */
function getLevelScopes(scopes: Scope[], level: AccessLevel): Scope[] {
  return scopes.filter(scope => (level === 'read') === (scope.action === 'read'));
}

function getLevelTagVariant(level: AccessLevel, granted: Scope[]) {
  if (granted.some(scope => scope.costImpact)) {
    return 'warning';
  }
  if (granted.some(scope => scope.irreversible)) {
    return 'danger';
  }
  return level === 'read' ? 'info' : 'success';
}

function ScopeLegend() {
  return (
    <Flex gap="md" wrap="wrap" align="center">
      <Tag variant="info">{t('Read')}</Tag>
      <Tag variant="success">{t('Write')}</Tag>
      <Tag variant="danger">{t('Includes irreversible actions')}</Tag>
      <Tag variant="warning">{t('Includes cost impact')}</Tag>
      <Text size="sm" variant="muted">
        {t('* limited to data the service account created')}
      </Text>
    </Flex>
  );
}

function CategoryHeading({category}: {category: ScopeCategory}) {
  return (
    <Flex gap="sm" align="baseline" wrap="wrap">
      <Text bold uppercase size="sm">
        {category.label}
      </Text>
      <Text size="xs" variant="muted">
        {category.appliesTo === 'projects'
          ? t('Applies to the selected projects')
          : t('Applies to the whole organization')}
      </Text>
    </Flex>
  );
}

function PermissionSummary({bundle}: {bundle: Bundle}) {
  const writable = SCOPE_RESOURCES.map(resource =>
    getLevelScopes(getGrantedScopes(bundle, resource), 'write')
  ).filter(scopes => scopes.length > 0);
  const readable = SCOPE_RESOURCES.filter(
    resource => getLevelScopes(getGrantedScopes(bundle, resource), 'read').length > 0
  );
  return (
    <Text size="sm" variant="muted">
      {t(
        'Read %s · Write %s · %s irreversible · %s cost impacting',
        readable.length,
        writable.length,
        writable.filter(scopes => scopes.some(scope => scope.irreversible)).length,
        writable.filter(scopes => scopes.some(scope => scope.costImpact)).length
      )}
    </Text>
  );
}

function hasOwnDataMarker(
  bundle: Bundle,
  resource: ScopeResource,
  scope: Scope,
  dataAccess: DataAccess | null
) {
  return (
    (dataAccess === 'own' && !resource.ownerless && isLimitedByDataAccess(scope)) ||
    !!bundle.ownDataOnlyScopes?.includes(scope.scope)
  );
}

/**
 * Lists permissions grouped by category. Read-only by default; pass `onSetScopes` to
 * make Read and Write checkboxes (used by the Custom bundle).
 */
function BundlePermissions({
  bundle,
  dataAccess,
  blockedScopes,
  onSetScopes,
}: {
  bundle: Bundle;
  dataAccess: DataAccess | null;
  /** Scopes a guardrail blocks, with the reason. Only used when editable. */
  blockedScopes?: Map<string, string>;
  onSetScopes?: (scopes: string[], enabled: boolean) => void;
}) {
  const editable = !!onSetScopes;

  return (
    <Stack gap="lg">
      <ScopeLegend />
      {SCOPE_CATEGORIES.map((category, index) => (
        <Stack key={category.id} gap="lg">
          {index > 0 && <Stack.Separator />}
          <CategoryHeading category={category} />
          <Grid columns="minmax(180px, 1fr) 2fr" gap="md xl" align="center">
            {getCategoryResources(category.id).map(resource => {
              const granted = getGrantedScopes(bundle, resource);
              const levels = (['read', 'write'] as const).filter(
                level => getLevelScopes(resource.scopes, level).length > 0
              );
              const shownLevels = editable
                ? levels
                : levels.filter(level => getLevelScopes(granted, level).length > 0);
              return (
                <Fragment key={resource.id}>
                  <Stack gap="2xs">
                    <Text bold variant={granted.length ? 'primary' : 'muted'}>
                      {resource.label}
                    </Text>
                    <Text size="sm" variant="muted">
                      {resource.help}
                    </Text>
                  </Stack>
                  <Flex gap={editable ? 'md' : 'xs'} wrap="wrap">
                    {shownLevels.length === 0 ? (
                      <Text size="sm" variant="muted">
                        {t('No access')}
                      </Text>
                    ) : (
                      shownLevels.map(level => {
                        const levelScopes = getLevelScopes(resource.scopes, level);
                        const levelGranted = getLevelScopes(granted, level);
                        const label = `${ACCESS_LEVEL_LABELS[level]}${
                          levelGranted.some(scope =>
                            hasOwnDataMarker(bundle, resource, scope, dataAccess)
                          )
                            ? '*'
                            : ''
                        }`;
                        const variant = getLevelTagVariant(
                          level,
                          editable ? levelScopes : levelGranted
                        );
                        if (!editable) {
                          return (
                            <Tag key={level} variant={variant}>
                              {label}
                            </Tag>
                          );
                        }
                        // Disabled only when a guardrail blocks every scope in the level.
                        const blockedReason = levelScopes.every(scope =>
                          blockedScopes?.has(scope.scope)
                        )
                          ? blockedScopes?.get(levelScopes[0]!.scope)
                          : undefined;
                        return (
                          <Flex key={level} as="label" gap="xs" align="center">
                            <Checkbox
                              size="xs"
                              checked={levelGranted.length > 0}
                              disabled={!!blockedReason}
                              tooltipProps={
                                blockedReason ? {title: blockedReason} : undefined
                              }
                              onChange={() =>
                                onSetScopes(
                                  levelScopes.map(scope => scope.scope),
                                  levelGranted.length === 0
                                )
                              }
                            />
                            <Tag variant={variant}>{label}</Tag>
                          </Flex>
                        );
                      })
                    )}
                  </Flex>
                </Fragment>
              );
            })}
          </Grid>
        </Stack>
      ))}
    </Stack>
  );
}

export default function NewServiceAccount() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // Starts as All Projects. The selector resolves it to the current project IDs.
  const [selectedProjects, setSelectedProjects] = useState<number[]>([
    ALL_ACCESS_PROJECTS,
  ]);
  const {projects: accessibleProjects} = useAccessibleProjects();
  const allProjectsSelected =
    selectedProjects.includes(ALL_ACCESS_PROJECTS) ||
    (accessibleProjects.length > 0 &&
      selectedProjects.length === accessibleProjects.length);
  const [bundleId, setBundleId] = useState<string>(DEFAULT_BUNDLE_ID);
  // Which bundle's "View permissions" is open. Selecting a bundle collapses it.
  const [expandedBundleId, setExpandedBundleId] = useState<string | null>(null);
  const selectBundle = (id: string) => {
    if (id !== bundleId) {
      setExpandedBundleId(null);
    }
    setBundleId(id);
  };
  const [guardrails, setGuardrails] = useState<GuardrailId[]>([
    'cost_impact',
    'data_irreversible',
  ]);
  // Custom starts from Default Agent, so there is something to edit.
  const [customScopes, setCustomScopes] = useState<string[]>(
    () => BUNDLES.find(bundle => bundle.id === DEFAULT_BUNDLE_ID)!.scopes
  );

  const bundles = BUNDLES.map(bundle =>
    bundle.id === CUSTOM_BUNDLE_ID ? {...bundle, scopes: customScopes} : bundle
  );
  const selectedBundle = bundles.find(bundle => bundle.id === bundleId)!;

  /** Why a guardrail has no effect on a bundle, if it doesn't. */
  const getGuardrailNoEffectReason = (guardrail: Guardrail, bundle: Bundle) => {
    if (bundle.dataAccess === null) {
      return t('%s cannot change anything.', bundle.name);
    }
    if (guardrail.effect === 'own_data_only' && bundle.dataAccess === 'own') {
      return t('%s only changes its own data.', bundle.name);
    }
    return null;
  };

  const getActiveGuardrails = (bundle: Bundle) =>
    guardrails.filter(id => {
      const guardrail = GUARDRAILS.find(g => g.id === id);
      return guardrail && getGuardrailNoEffectReason(guardrail, bundle) === null;
    });

  const activeGuardrails = getActiveGuardrails(selectedBundle);

  const toggleGuardrail = (id: GuardrailId) =>
    setGuardrails(current =>
      current.includes(id) ? current.filter(g => g !== id) : [...current, id]
    );

  const setCustomScopesEnabled = (scopes: string[], enabled: boolean) =>
    setCustomScopes(current =>
      enabled
        ? [...new Set([...current, ...scopes])]
        : current.filter(scope => !scopes.includes(scope))
    );

  // Scopes the active guardrails would remove from Custom, with the guardrail's name.
  const customBundle = bundles.find(bundle => bundle.id === CUSTOM_BUNDLE_ID)!;
  const customBlockedScopes = new Map<string, string>();
  for (const id of getActiveGuardrails(customBundle)) {
    const guardrail = GUARDRAILS.find(g => g.id === id)!;
    const allowed = applyGuardrails({...customBundle, scopes: ALL_SCOPE_IDS}, [
      id,
    ]).scopes;
    for (const scope of ALL_SCOPE_IDS) {
      if (!allowed.includes(scope)) {
        customBlockedScopes.set(scope, t('Blocked by "%s"', guardrail.name));
      }
    }
  }

  const canSubmit = name.trim().length > 0 && selectedProjects.length > 0;

  const handleSubmit = () => {
    addSuccessMessage(t('Created service account "%s" (%s).', name, selectedBundle.name));
  };

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Create Service Account')} />
      <SettingsPageHeader
        title={t('Create Service Account')}
        subtitle={t(
          'Service accounts are non-human members of your organization, used by automation such as CI pipelines, scripts and bots. Choose what it can access and what it can do.'
        )}
      />

      <Panel>
        <PanelHeader>{t('1. Details')}</PanelHeader>
        <PanelBody>
          <FieldGroup
            label={t('Name')}
            help={t('A name to help you identify this service account.')}
            required
          >
            <Input
              value={name}
              placeholder={t('e.g. GitHub Actions deploy bot')}
              onChange={e => setName(e.target.value)}
            />
          </FieldGroup>
          <FieldGroup
            label={t('Description')}
            help={t('Optional. What is this service account used for?')}
          >
            <TextArea
              value={description}
              rows={2}
              autosize
              onChange={e => setDescription(e.target.value)}
            />
          </FieldGroup>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>{t('2. Project Access')}</PanelHeader>
        <PanelBody>
          <FieldGroup
            label={t('Projects')}
            help={t('Which projects this service account can access.')}
          >
            <ServiceAccountProjectSelect
              value={selectedProjects}
              onChange={setSelectedProjects}
            />
          </FieldGroup>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>{t('3. Permissions')}</PanelHeader>
        <PanelBody>
          <FieldGroup
            label={t('Guardrails')}
            help={t('Extra restrictions applied to whichever bundle you choose below.')}
          >
            <Stack gap="md">
              {GUARDRAILS.map(guardrail => {
                const noEffectReason = getGuardrailNoEffectReason(
                  guardrail,
                  selectedBundle
                );
                return (
                  <Flex key={guardrail.id} as="label" gap="md" align="start">
                    <Checkbox
                      disabled={noEffectReason !== null}
                      tooltipProps={noEffectReason ? {title: noEffectReason} : undefined}
                      checked={
                        // Show "already the case" restrictions as checked, since the bundle
                        // already behaves that way.
                        guardrail.effect === 'own_data_only' &&
                        selectedBundle.dataAccess === 'own'
                          ? true
                          : guardrails.includes(guardrail.id)
                      }
                      onChange={() => toggleGuardrail(guardrail.id)}
                    />
                    <Stack gap="2xs">
                      <Text bold variant={noEffectReason ? 'muted' : 'primary'}>
                        {guardrail.name}
                      </Text>
                      <Text size="sm" variant="muted">
                        {guardrail.description}
                      </Text>
                    </Stack>
                  </Flex>
                );
              })}
            </Stack>
          </FieldGroup>
          {bundles.map(bundle => {
            const isCustom = bundle.id === CUSTOM_BUNDLE_ID;
            return (
              <PanelItem key={bundle.id}>
                <Stack gap="md" flex="1" minWidth="0">
                  <Flex
                    gap="lg"
                    align="center"
                    style={{cursor: 'pointer'}}
                    onClick={() => selectBundle(bundle.id)}
                  >
                    <Radio
                      name="bundle"
                      value={bundle.id}
                      aria-label={bundle.name}
                      checked={bundle.id === bundleId}
                      readOnly
                    />
                    <Stack gap="xs">
                      <Text bold>{bundle.name}</Text>
                      <Text variant="muted">{bundle.description}</Text>
                      <PermissionSummary
                        bundle={applyGuardrails(bundle, getActiveGuardrails(bundle))}
                      />
                    </Stack>
                  </Flex>
                  {isCustom ? (
                    // The picker is the point of Custom, so it opens as soon as Custom is
                    // selected instead of sitting behind an expander.
                    bundle.id === bundleId && (
                      <BundlePermissions
                        bundle={applyGuardrails(bundle, getActiveGuardrails(bundle))}
                        dataAccess={bundle.dataAccess}
                        blockedScopes={customBlockedScopes}
                        onSetScopes={setCustomScopesEnabled}
                      />
                    )
                  ) : (
                    <Disclosure
                      size="sm"
                      expanded={expandedBundleId === bundle.id}
                      onExpandedChange={isExpanded =>
                        setExpandedBundleId(isExpanded ? bundle.id : null)
                      }
                    >
                      <Disclosure.Title>{t('View permissions')}</Disclosure.Title>
                      <Disclosure.Content>
                        <BundlePermissions
                          bundle={applyGuardrails(bundle, getActiveGuardrails(bundle))}
                          dataAccess={bundle.dataAccess}
                        />
                      </Disclosure.Content>
                    </Disclosure>
                  )}
                </Stack>
              </PanelItem>
            );
          })}
          <PanelItem>
            <Text size="sm" variant="muted">
              {t(
                'A service account can never have more permissions than you. If higher permissions are required, another user in your org who holds those permissions can update the service account.'
              )}
            </Text>
          </PanelItem>
        </PanelBody>
      </Panel>

      <Grid columns="1fr auto" align="center" gap="md" padding="xl 0">
        <Text variant="muted">
          {t(
            '%s · %s · %s',
            selectedBundle.name,
            activeGuardrails.length
              ? t('%s guardrail(s)', activeGuardrails.length)
              : t('No guardrails'),
            allProjectsSelected
              ? t('All projects')
              : t('%s project(s)', selectedProjects.length)
          )}
        </Text>
        <Flex gap="md">
          <Button onClick={() => window.history.back()}>{t('Cancel')}</Button>
          <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit}>
            {t('Create Service Account')}
          </Button>
        </Flex>
      </Grid>
    </Fragment>
  );
}
