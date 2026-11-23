import {IconAdd} from '@sentry/icons/add';
import {IconClose} from '@sentry/icons/close';
import {IconLock} from '@sentry/icons/lock';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {DisplayField} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Switch} from '@sentry/scraps/switch';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {SENTRY_APP_PERMISSIONS} from 'sentry/constants';
import {t, tn} from 'sentry/locale';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import type {SeerServiceAccountResponse} from 'sentry/views/seerWorkflows/types';

export type ProjectSelection = {allProjects: boolean; projectIds: string[]};

/**
 * Its projectIds are granted on top of the projects in the automation's scope
 */
type ServiceAccountProjectAccess = ProjectSelection;

const PROJECT_COLUMNS: TableColumnConfig[] = [
  {key: 'project', width: 'minmax(0, 1fr)'},
  {key: 'action', width: 'auto'},
];

const PROJECT_COLUMNS_WITH_REASON: TableColumnConfig[] = [
  {key: 'project', width: 'minmax(0, 1fr)'},
  {key: 'reason', width: 'minmax(0, 1fr)'},
  {key: 'action', width: 'auto'},
];

const PERMISSION_COLUMNS: TableColumnConfig[] = [
  {key: 'resource', width: 'minmax(0, 1fr)'},
  {key: 'access', width: 'auto'},
];

/**
 * Monitors scope an automation to an explicit list of their projects
 */
export function getMonitorScopeProjects(monitors: MetricDetector[]): ProjectSelection {
  return {
    allProjects: false,
    projectIds: [...new Set(monitors.map(monitor => monitor.projectId))],
  };
}

/**
 * The projects in the automation's scope are always granted. Empty when the
 * account or the scope covers all projects.
 */
export function getServiceAccountProjectIds(
  access: ServiceAccountProjectAccess,
  scopeProjects?: ProjectSelection
): string[] {
  if (access.allProjects || scopeProjects?.allProjects) {
    return [];
  }
  return [...new Set([...(scopeProjects?.projectIds ?? []), ...access.projectIds])].sort(
    (a, b) => Number(a) - Number(b)
  );
}

/**
 * The project access saved on a service account, or none when there is no account yet
 */
export function getServiceAccountProjectSelection(
  serviceAccount: SeerServiceAccountResponse | null
): ServiceAccountProjectAccess {
  return {
    allProjects: serviceAccount?.allProjects ?? false,
    projectIds: serviceAccount?.projectIds.map(String) ?? [],
  };
}

export const DEFAULT_SERVICE_ACCOUNT_SCOPES = [
  'event:read',
  'member:read',
  'org:read',
  'project:read',
  'team:read',
];

const RESOURCE_ORDER = [
  'Event',
  'Alerts',
  'Project',
  'Release',
  'Organization',
  'Team',
  'Member',
  'Distribution',
];

export const PERMISSIONS = SENTRY_APP_PERMISSIONS.toSorted(
  (a, b) => RESOURCE_ORDER.indexOf(a.resource) - RESOURCE_ORDER.indexOf(b.resource)
);

/**
 * Choices ascend, so the last one fully granted is the current level
 */
export function getPermissionLevel(
  permission: (typeof SENTRY_APP_PERMISSIONS)[number],
  scopes: Set<string>
): string {
  return (
    Object.entries(permission.choices).findLast(
      ([, choice]) =>
        choice.scopes.length > 0 && choice.scopes.every(scope => scopes.has(scope))
    )?.[0] ?? 'no-access'
  );
}

export function ServiceAccountSummary({
  access,
  scopeProjects,
  scopes,
}: {
  access: ServiceAccountProjectAccess;
  scopes: string[];
  /**
   * Projects the automation is scoped to, which are always granted
   */
  scopeProjects?: ProjectSelection;
}) {
  const projectCount = getServiceAccountProjectIds(access, scopeProjects).length;
  const selected = new Set(scopes);
  const levels = PERMISSIONS.map(permission => getPermissionLevel(permission, selected));
  let projects = tn('%s project', '%s projects', projectCount);
  if (access.allProjects || scopeProjects?.allProjects) {
    projects = t('All projects');
  } else if (projectCount === 0) {
    projects = t('No projects');
  }
  const permissions = tn(
    '%s permission',
    '%s permissions',
    levels.filter(level => level !== 'no-access').length
  );

  return <Text>{`${projects} · ${permissions}`}</Text>;
}

export function ServiceAccountProjects({
  value,
  monitors,
  disabled,
  onChange,
}: {
  disabled: boolean;
  monitors: MetricDetector[];
  onChange: (value: ServiceAccountProjectAccess) => void;
  value: ServiceAccountProjectAccess;
}) {
  return (
    <ProjectSelector
      value={value}
      scopeProjects={getMonitorScopeProjects(monitors)}
      isMonitorScoped
      disabled={disabled}
      onChange={onChange}
      emptyMessage={t(
        'Connect a monitor or add a project to give the service account access.'
      )}
    />
  );
}

/**
 * Whether the user's role reaches every project in the organization
 */
export function useHasAllProjectsAccess(): boolean {
  const organization = useOrganization();
  return (
    organization.orgRoleList?.find(role => role.id === organization.orgRole)?.isGlobal ??
    false
  );
}

/**
 * Picks all projects or a list of them. Projects in the automation's scope are
 * always included and can't be removed.
 */
export function ProjectSelector({
  value,
  scopeProjects,
  isMonitorScoped = false,
  showReason = true,
  disabled,
  emptyMessage,
  onChange,
}: {
  disabled: boolean;
  emptyMessage: string;
  onChange: (value: ProjectSelection) => void;
  value: ProjectSelection;
  /**
   * Whether the scope comes from connected monitors, which changes the wording
   */
  isMonitorScoped?: boolean;
  /**
   * Projects the automation is scoped to. A scope of all projects forces all
   * projects here.
   */
  scopeProjects?: ProjectSelection;
  /**
   * Whether to show why each project is included
   */
  showReason?: boolean;
}) {
  const {projects} = useProjects();
  // Only global roles can grant all projects, or narrow an account that has them
  const canToggleAllProjects = useHasAllProjectsAccess();

  const scopeAllProjects = scopeProjects?.allProjects ?? false;
  const allProjects = value.allProjects || scopeAllProjects;
  const scopeIds = new Set(scopeProjects?.projectIds);
  const isLocked = (projectId: string) => scopeIds.has(projectId);
  const scopeReason = isMonitorScoped ? t('Connected Monitors') : t('Automation scope');
  const grantedIds = new Set(getServiceAccountProjectIds(value, scopeProjects));
  const granted = projects
    .filter(project => grantedIds.has(project.id))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const addable = projects.filter(
    project =>
      !isLocked(project.id) &&
      (project.hasAccess || value.projectIds.includes(project.id))
  );

  return (
    <Stack gap="md" width="100%" minWidth={0}>
      <DisplayField.Row
        padding="0"
        label={t('All projects')}
        hintText={t('Include every project in the organization, including new ones.')}
      >
        <Flex>
          <Tooltip
            disabled={canToggleAllProjects && !scopeAllProjects}
            title={
              scopeAllProjects
                ? t('Set by automation scope')
                : t('Only roles with access to all projects can change this.')
            }
          >
            <Switch
              aria-label={t('All projects')}
              checked={allProjects}
              disabled={disabled || !canToggleAllProjects || scopeAllProjects}
              onChange={() => onChange({...value, allProjects: !value.allProjects})}
            />
          </Tooltip>
        </Flex>
      </DisplayField.Row>
      {!allProjects && (
        <Flex align="center" justify="between" gap="md">
          <Text size="sm" variant="muted">
            {scopeProjects
              ? `${tn('%s project', '%s projects', granted.length)} · ${
                  isMonitorScoped
                    ? t('%s from connected monitors', scopeIds.size)
                    : t('%s from automation scope', scopeIds.size)
                }`
              : tn('%s project', '%s projects', granted.length)}
          </Text>
          <CompactSelect
            multiple
            search
            menuWidth={320}
            position="bottom-end"
            disabled={disabled}
            options={addable.map(project => ({
              value: project.id,
              label: project.slug,
              leadingItems: <ProjectAvatar project={project} size={16} />,
            }))}
            value={value.projectIds.filter(id => !isLocked(id))}
            onChange={selected =>
              onChange({...value, projectIds: selected.map(option => option.value)})
            }
            emptyMessage={t('No other projects to add')}
            trigger={triggerProps => (
              <OverlayTrigger.Button {...triggerProps} size="sm" icon={<IconAdd />}>
                {t('Add projects')}
              </OverlayTrigger.Button>
            )}
          />
        </Flex>
      )}
      {!allProjects && (
        <SimpleTable
          columns={showReason ? PROJECT_COLUMNS_WITH_REASON : PROJECT_COLUMNS}
          header={
            <SimpleTable.HeaderRow>
              <SimpleTable.HeaderCell>{t('Project')}</SimpleTable.HeaderCell>
              {showReason && (
                <SimpleTable.HeaderCell>{t('Included because')}</SimpleTable.HeaderCell>
              )}
              <SimpleTable.HeaderCell />
            </SimpleTable.HeaderRow>
          }
        >
          {granted.length === 0 && <SimpleTable.Empty>{emptyMessage}</SimpleTable.Empty>}
          {granted.map(project => (
            <SimpleTable.Row key={project.id}>
              <SimpleTable.RowCell>
                <ProjectBadge project={project} avatarSize={16} disableLink />
              </SimpleTable.RowCell>
              {showReason && (
                <SimpleTable.RowCell>
                  <Text size="sm" variant="muted">
                    {isLocked(project.id) ? scopeReason : t('Added manually')}
                  </Text>
                </SimpleTable.RowCell>
              )}
              <SimpleTable.RowCell justify="end">
                {isLocked(project.id) ? (
                  <Button
                    size="xs"
                    variant="transparent"
                    icon={<IconLock locked />}
                    aria-label={
                      isMonitorScoped
                        ? t('%s is included by its connected monitors', project.slug)
                        : t('%s is included by automation scope', project.slug)
                    }
                    tooltipProps={{
                      title: isMonitorScoped
                        ? t('Included by its connected monitors')
                        : t('Included by automation scope'),
                    }}
                    disabled
                  />
                ) : (
                  <Button
                    size="xs"
                    variant="transparent"
                    icon={<IconClose />}
                    aria-label={t('Remove %s', project.slug)}
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...value,
                        projectIds: value.projectIds.filter(id => id !== project.id),
                      })
                    }
                  />
                )}
              </SimpleTable.RowCell>
            </SimpleTable.Row>
          ))}
        </SimpleTable>
      )}
    </Stack>
  );
}

export function ServiceAccountPermissions({
  value,
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange: (scopes: string[]) => void;
  value: string[];
}) {
  const organization = useOrganization();
  const grantable = new Set<string>(organization.access);
  const selected = new Set(value);

  return (
    <SimpleTable
      columns={PERMISSION_COLUMNS}
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Resource')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Access')}</SimpleTable.HeaderCell>
        </SimpleTable.HeaderRow>
      }
    >
      {PERMISSIONS.map(permission => {
        const label = permission.label ?? permission.resource;
        const choices = Object.entries(permission.choices);
        const resourceScopes = new Set<string>(
          choices.flatMap(([, choice]) => choice.scopes)
        );
        const level = getPermissionLevel(permission, selected);
        return (
          <SimpleTable.Row key={permission.resource}>
            <SimpleTable.RowCell>
              <Stack gap="xs">
                <Text bold>{label}</Text>
                <Text size="sm" variant="muted">
                  {permission.help}
                </Text>
              </Stack>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell justify="end">
              <CompactSelect
                size="sm"
                strategy="fixed"
                position="bottom-end"
                disabled={disabled}
                value={level}
                options={choices.map(([choiceLevel, choice]) => {
                  const cannotGrant =
                    choiceLevel !== level &&
                    !choice.scopes.every(scope => grantable.has(scope));
                  return {
                    value: choiceLevel,
                    label: choice.label,
                    disabled: cannotGrant,
                    tooltip: cannotGrant
                      ? t("You can't grant access you don't have.")
                      : undefined,
                  };
                })}
                onChange={option =>
                  onChange(
                    [
                      ...value.filter(scope => !resourceScopes.has(scope)),
                      ...(choices.find(
                        ([choiceLevel]) => choiceLevel === option.value
                      )?.[1].scopes ?? []),
                    ].sort()
                  )
                }
                trigger={triggerProps => (
                  <OverlayTrigger.Button
                    {...triggerProps}
                    aria-label={t('%s permission', label)}
                  />
                )}
              />
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        );
      })}
    </SimpleTable>
  );
}
