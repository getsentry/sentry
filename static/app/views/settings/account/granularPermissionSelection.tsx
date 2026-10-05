import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {FieldGroup} from 'sentry/components/forms/fieldGroup';
import {GRANULAR_SENTRY_APP_PERMISSIONS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {capitalize} from 'sentry/utils/string/capitalize';

const NO_ACCESS = 'no-access';

/**
 * Selected level per row, keyed by row label. A missing row has no access.
 */
export type GranularPermissions = Partial<Record<string, string>>;

/**
 * Expands the selected levels into scopes. A level grants every level before
 * it, so Dashboards at `write` becomes `dashboard:read`, `dashboard:create`, and
 * `dashboard:write`.
 */
export function granularPermissionsToScopes(permissions: GranularPermissions): string[] {
  return GRANULAR_SENTRY_APP_PERMISSIONS.flatMap(({label, resource, levels}) => {
    const selected = permissions[label];
    if (!selected) {
      return [];
    }
    return levels
      .slice(0, levels.indexOf(selected) + 1)
      .map(level => `${resource}:${level}`);
  });
}

type Props = {
  onChange: (permissions: GranularPermissions) => void;
  permissions: GranularPermissions;
};

export function GranularPermissionSelection({permissions, onChange}: Props) {
  return (
    <Fragment>
      <Flex padding="md xl">
        <Text variant="muted" size="sm">
          {t('Each access level also grants the levels listed before it.')}
        </Text>
      </Flex>
      {GRANULAR_SENTRY_APP_PERMISSIONS.map(({resource, label, help, levels}) => (
        <FieldGroup key={label} label={label} help={help}>
          <Select
            aria-label={label}
            name={`${resource}--granular-permission`}
            value={permissions[label] ?? NO_ACCESS}
            options={[
              {value: NO_ACCESS, label: t('No Access')},
              ...levels.map(level => ({value: level, label: capitalize(level)})),
            ]}
            onChange={({value}: {value: string}) =>
              onChange({...permissions, [label]: value === NO_ACCESS ? undefined : value})
            }
          />
        </FieldGroup>
      ))}
    </Fragment>
  );
}
