import {Fragment} from 'react';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {FieldGroup} from 'sentry/components/forms/fieldGroup';
import {GRANULAR_SENTRY_APP_PERMISSIONS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {capitalize} from 'sentry/utils/string/capitalize';

const NO_ACCESS = 'no-access';

export type GranularPermissions = {
  /**
   * Scopes granted independently of a level, e.g. `member:invite`.
   */
  extraScopes: string[];
  /**
   * Selected level per resource. A missing resource has no access.
   */
  levels: Partial<Record<string, string>>;
};

/**
 * Expands the selected levels into scopes. A level grants every level before
 * it, so `dashboard: 'write'` becomes `dashboard:read`, `dashboard:create`, and
 * `dashboard:write`.
 */
export function granularPermissionsToScopes({
  extraScopes,
  levels: selectedLevels,
}: GranularPermissions): string[] {
  const levelScopes = GRANULAR_SENTRY_APP_PERMISSIONS.flatMap(({resource, levels}) => {
    const selected = selectedLevels[resource];
    if (!selected) {
      return [];
    }
    return levels
      .slice(0, levels.indexOf(selected) + 1)
      .map(level => `${resource}:${level}`);
  });

  return [...levelScopes, ...extraScopes];
}

type Props = {
  onChange: (permissions: GranularPermissions) => void;
  permissions: GranularPermissions;
};

export function GranularPermissionSelection({permissions, onChange}: Props) {
  const handleLevelChange = (resource: string, level: string) => {
    onChange({
      ...permissions,
      levels: {
        ...permissions.levels,
        [resource]: level === NO_ACCESS ? undefined : level,
      },
    });
  };

  const handleExtraChange = (scope: string, checked: boolean) => {
    onChange({
      ...permissions,
      extraScopes: checked
        ? [...permissions.extraScopes, scope]
        : permissions.extraScopes.filter(extraScope => extraScope !== scope),
    });
  };

  return (
    <Fragment>
      <Flex padding="md xl">
        <Text variant="muted" size="sm">
          {t('Each access level also grants the levels listed before it.')}
        </Text>
      </Flex>
      {GRANULAR_SENTRY_APP_PERMISSIONS.map(({resource, label, levels, extras = []}) => (
        <FieldGroup key={resource} label={label}>
          <Stack gap="md">
            <Select
              aria-label={label}
              name={`${resource}--granular-permission`}
              value={permissions.levels[resource] ?? NO_ACCESS}
              options={[
                {value: NO_ACCESS, label: t('No Access')},
                ...levels.map(level => ({value: level, label: capitalize(level)})),
              ]}
              onChange={({value}: {value: string}) => handleLevelChange(resource, value)}
            />
            {extras.map(extra => {
              const scope = `${resource}:${extra}`;
              return (
                <Flex as="label" key={scope} align="center" gap="sm">
                  <Checkbox
                    checked={permissions.extraScopes.includes(scope)}
                    onChange={event => handleExtraChange(scope, event.target.checked)}
                  />
                  <Text>{capitalize(extra)}</Text>
                </Flex>
              );
            })}
          </Stack>
        </FieldGroup>
      ))}
    </Fragment>
  );
}
