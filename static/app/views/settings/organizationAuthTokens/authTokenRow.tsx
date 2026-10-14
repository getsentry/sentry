import {IconDelete} from '@sentry/icons/delete';

import {Button} from '@sentry/scraps/button';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Confirm} from 'sentry/components/confirm';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {OrgAuthToken} from 'sentry/types/user';
import {tokenPreview} from 'sentry/views/settings/organizationAuthTokens';

function LastUsed({
  organization,
  dateLastUsed,
  projectLastUsed,
}: {
  organization: Organization;
  dateLastUsed?: Date;
  projectLastUsed?: Project;
}) {
  if (dateLastUsed && projectLastUsed) {
    return (
      <Text wordBreak="break-word">
        {tct('[date] in project [project]', {
          date: (
            <Text wrap="nowrap">
              <TimeSince date={dateLastUsed} />
            </Text>
          ),
          project: (
            <Link to={`/settings/${organization.slug}/projects/${projectLastUsed.slug}/`}>
              {projectLastUsed.name}
            </Link>
          ),
        })}
      </Text>
    );
  }

  if (dateLastUsed) {
    return (
      <Text wrap="nowrap">
        <TimeSince date={dateLastUsed} />
      </Text>
    );
  }

  if (projectLastUsed) {
    return (
      <Text wordBreak="break-word">
        {tct('in project [project]', {
          project: (
            <Link to={`/settings/${organization.slug}/${projectLastUsed.slug}/`}>
              {projectLastUsed.name}
            </Link>
          ),
        })}
      </Text>
    );
  }

  return <Text variant="muted">{t('never used')}</Text>;
}

export function OrganizationAuthTokensAuthTokenRow({
  organization,
  isRevoking,
  token,
  revokeToken,
  projectLastUsed,
  isProjectLoading,
}: {
  isRevoking: boolean;
  organization: Organization;
  token: OrgAuthToken;
  isProjectLoading?: boolean;
  projectLastUsed?: Project;
  revokeToken?: (token: OrgAuthToken) => void;
}) {
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell direction="column" align="start">
        <Text wordBreak="break-word">
          <Link to={`/settings/${organization.slug}/auth-tokens/${token.id}/`}>
            {token.name}
          </Link>
        </Text>

        {token.tokenLastCharacters && (
          <Text variant="muted" aria-label={t('Token preview')} wordBreak="break-word">
            {tokenPreview(token.tokenLastCharacters, 'sntrys_')}
          </Text>
        )}
      </SimpleTable.RowCell>

      <SimpleTable.RowCell gap="xs">
        {isProjectLoading ? (
          <Placeholder height="1.25em" />
        ) : (
          <Text wrap="nowrap">
            <TimeSince date={token.dateCreated} />
          </Text>
        )}
      </SimpleTable.RowCell>

      <SimpleTable.RowCell gap="xs">
        {isProjectLoading ? (
          <Placeholder height="1.25em" />
        ) : (
          <LastUsed
            dateLastUsed={token.dateLastUsed}
            projectLastUsed={projectLastUsed}
            organization={organization}
          />
        )}
      </SimpleTable.RowCell>

      <SimpleTable.RowCell justify="end">
        <Tooltip
          title={t('You must be an organization owner or manager to revoke a token.')}
          disabled={!!revokeToken}
        >
          <Confirm
            disabled={!revokeToken || isRevoking}
            onConfirm={revokeToken ? () => revokeToken(token) : undefined}
            message={t(
              'Are you sure you want to revoke %s token? It will not be usable anymore, and this cannot be undone.',
              tokenPreview(token.tokenLastCharacters || '', 'sntrys_')
            )}
          >
            <Button
              size="sm"
              disabled={isRevoking || !revokeToken}
              aria-label={t('Revoke %s', token.name)}
              icon={<IconDelete />}
            >
              {t('Revoke')}
            </Button>
          </Confirm>
        </Tooltip>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}
