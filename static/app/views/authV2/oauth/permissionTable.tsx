import {Fragment} from 'react';
import {css} from '@emotion/react';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconInfo} from '@sentry/icons/info';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';

import type {OAuthContext} from './types';

const ACCESS_ACTIONS = ['read', 'write', 'admin'];
const ACCESS_LABELS = {read: t('Read'), write: t('Write'), admin: t('Admin')};
const ROW_HEIGHT = 32;
type PermissionGroup = OAuthContext['permissionGroups'][number];

export function PermissionTable({groups}: {groups: OAuthContext['permissionGroups']}) {
  const sortedGroups = groups.toSorted(
    (a, b) => permissionPriority(a) - permissionPriority(b)
  );

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
        {sortedGroups.map((group, index) => (
          <PermissionRow
            key={group.resource}
            group={group}
            isLast={index === sortedGroups.length - 1}
          />
        ))}
      </Grid>
    </Grid>
  );
}

function permissionPriority(group: PermissionGroup) {
  if (group.actions.includes('admin')) {
    return 0;
  }

  if (group.actions.includes('write')) {
    return 1;
  }

  if (
    group.description ||
    group.actions.some(action => !ACCESS_ACTIONS.includes(action))
  ) {
    return 2;
  }

  return 3;
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
    <Tooltip
      skipWrapper
      position="right"
      maxWidth={270}
      disabled={
        !details && !ACCESS_ACTIONS.some(action => group.accessDescriptions?.[action])
      }
      title={
        <Stack gap="md" align="start">
          <Grid
            as="dl"
            columns="max-content minmax(0, 1fr)"
            gap="sm md"
            align="baseline"
            css={css`
              margin: 0;
              & dd {
                margin: 0;
              }

              & [data-disabled='true'] {
                opacity: 0.65;
              }
            `}
          >
            {(['read', 'write', 'admin'] as const).map(action =>
              group.accessDescriptions?.[action] ? (
                <Fragment key={action}>
                  <Text
                    bold
                    variant={group.actions.includes(action) ? 'inherit' : 'muted'}
                  >
                    {props => (
                      <dt {...props} data-disabled={!group.actions.includes(action)}>
                        {ACCESS_LABELS[action]}
                      </dt>
                    )}
                  </Text>
                  <Text
                    variant={group.actions.includes(action) ? 'inherit' : 'muted'}
                    align="left"
                  >
                    {props => (
                      <dd {...props} data-disabled={!group.actions.includes(action)}>
                        {group.accessDescriptions?.[action]}
                      </dd>
                    )}
                  </Text>
                </Fragment>
              ) : null
            )}
          </Grid>
          {details && (
            <Text variant="inherit" align="left">
              {details}
            </Text>
          )}
        </Stack>
      }
    >
      <Grid
        role="row"
        tabIndex={0}
        column="1 / -1"
        columns="subgrid"
        align="center"
        gap="md"
        minHeight={`${ROW_HEIGHT}px`}
        padding="sm lg"
        borderBottom={isLast ? undefined : 'secondary'}
        css={theme => css`
          &:hover,
          &:focus-visible {
            background: ${theme.tokens.background.secondary};
          }

          &:focus-visible {
            outline: 2px solid ${theme.tokens.focus.default};
            outline-offset: -2px;
          }
        `}
      >
        <Text role="rowheader" size="sm">
          {group.label}
        </Text>
        {ACCESS_ACTIONS.map(action => (
          <PermissionCell key={action} group={group} action={action} />
        ))}
        <Flex role="cell" justify="center" align="center">
          {details && (
            <Flex role="img" aria-label={t('Permission details')} align="center">
              <IconInfo size="xs" aria-hidden="true" />
            </Flex>
          )}
        </Flex>
      </Grid>
    </Tooltip>
  );
}

function PermissionCell({group, action}: {action: string; group: PermissionGroup}) {
  const description = group.accessDescriptions?.[action];
  const applicable = group.accessDescriptions
    ? Boolean(description)
    : group.actions.some(value => ACCESS_ACTIONS.includes(value));
  const granted = group.actions.includes(action);

  return (
    <Flex
      role="cell"
      aria-label={
        applicable ? (granted ? t('Granted') : t('Not granted')) : t('Not applicable')
      }
      justify="center"
      align="center"
    >
      {applicable && granted && (
        <Flex role="img" aria-label={t('Granted')} align="center" justify="center">
          <IconCheckmark size="xs" aria-hidden="true" />
        </Flex>
      )}
    </Flex>
  );
}
