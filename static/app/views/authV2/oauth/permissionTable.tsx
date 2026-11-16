import {css} from '@emotion/react';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconClose} from '@sentry/icons/close';
import {IconInfo} from '@sentry/icons/info';

import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';

import type {OAuthContext} from './types';

const ACCESS_ACTIONS = ['read', 'write', 'admin'];
const ROW_HEIGHT = 32;
type PermissionGroup = OAuthContext['permissionGroups'][number];

export function PermissionTable({groups}: {groups: OAuthContext['permissionGroups']}) {
  return (
    <Grid
      role="table"
      aria-label={t('Requested permissions')}
      columns="minmax(0, 1fr) repeat(4, max-content)"
      borderTop="secondary"
    >
      <Grid
        role="rowgroup"
        column="1 / -1"
        columns="subgrid"
        borderBottom="secondary"
        padding="sm lg"
      >
        <Grid role="row" column="1 / -1" columns="subgrid" align="center" gap="md">
          {[t('Permission'), t('Read'), t('Write'), t('Admin'), t('Other')].map(
            (label, index) => (
              <Text
                key={label}
                role="columnheader"
                size="xs"
                bold
                variant="muted"
                align={index === 0 ? 'left' : 'center'}
              >
                {label}
              </Text>
            )
          )}
        </Grid>
      </Grid>
      <Grid
        role="rowgroup"
        column="1 / -1"
        columns="subgrid"
        maxHeight={`${ROW_HEIGHT * 4.5}px`}
        overflowY="auto"
        tabIndex={0}
        aria-label={t('Permission list')}
        css={theme => css`
          outline: none;

          &:focus-visible {
            outline: 2px solid ${theme.tokens.focus.default};
            outline-offset: -2px;
          }
        `}
      >
        {groups.map((group, index) => (
          <PermissionRow
            key={group.resource}
            group={group}
            isLast={index === groups.length - 1}
          />
        ))}
      </Grid>
    </Grid>
  );
}

function PermissionRow({group, isLast}: {group: PermissionGroup; isLast: boolean}) {
  const additionalActions = group.actions.filter(
    action => !ACCESS_ACTIONS.includes(action)
  );
  const details = [
    ...additionalActions.map(action => group.accessDescriptions?.[action] ?? action),
    group.description,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Grid
      role="row"
      column="1 / -1"
      columns="subgrid"
      align="center"
      gap="md"
      minHeight={`${ROW_HEIGHT}px`}
      padding="sm lg"
      borderBottom={isLast ? undefined : 'secondary'}
    >
      <Text role="rowheader" size="sm">
        {group.label}
      </Text>
      {ACCESS_ACTIONS.map(action => (
        <PermissionCell key={action} group={group} action={action} />
      ))}
      <Flex role="cell" justify="center" align="center">
        {details && (
          <Tooltip skipWrapper title={details}>
            <Flex
              tabIndex={0}
              role="img"
              aria-label={t('Permission details')}
              align="center"
            >
              <IconInfo size="xs" aria-hidden="true" />
            </Flex>
          </Tooltip>
        )}
      </Flex>
    </Grid>
  );
}

function PermissionCell({group, action}: {action: string; group: PermissionGroup}) {
  const description = group.accessDescriptions?.[action];
  const applicable = group.accessDescriptions
    ? Boolean(description)
    : group.actions.some(value => ACCESS_ACTIONS.includes(value));
  const granted = group.actions.includes(action);
  const label = granted ? t('Granted') : t('Not granted');

  return (
    <Flex
      role="cell"
      aria-label={applicable ? undefined : t('Not applicable')}
      justify="center"
      align="center"
    >
      {applicable && (
        <Tooltip skipWrapper title={description ?? label}>
          <Flex
            tabIndex={0}
            role="img"
            aria-label={label}
            align="center"
            justify="center"
          >
            {granted ? (
              <IconCheckmark size="xs" aria-hidden="true" />
            ) : (
              <IconClose size="xs" variant="muted" aria-hidden="true" />
            )}
          </Flex>
        </Tooltip>
      )}
    </Flex>
  );
}
