import {AlertLink} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {ExternalLink, Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {Confirm} from 'sentry/components/confirm';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';

import type {DeprecatedApiKey} from './types';

type Props = {
  /**
   * Busy differs from loading in that busy is a result of an action like removing
   */
  busy: boolean;
  keys: DeprecatedApiKey[];

  /**
   * Loading refers to fetching the API Keys
   */
  loading: boolean;

  onAddApiKey: () => void;

  onRemove: (id: DeprecatedApiKey['id']) => void;
  organization: Organization;
};

const API_KEY_COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'auto'},
  {key: 'key', width: 'auto'},
  {key: 'actions', width: 'auto'},
];

export function OrganizationApiKeysList({
  organization,
  keys,
  busy,
  loading,
  onAddApiKey,
  onRemove,
}: Props) {
  const hasKeys = Boolean(keys?.length);

  return (
    <div>
      <SettingsPageHeader
        title={t('API Keys')}
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<IconAdd />}
            busy={busy}
            disabled={busy}
            onClick={onAddApiKey}
          >
            {t('New API Key')}
          </Button>
        }
      />

      <TextBlock>
        {tct(
          `API keys grant access to the [api:developer web API].
          If you're looking to configure a Sentry client, you'll need a
          client key which is available in your project settings.`,
          {
            api: <ExternalLink href="https://docs.sentry.io/api/" />,
          }
        )}
      </TextBlock>

      <AlertLink.Container>
        <AlertLink to="/settings/account/api/auth-tokens/" variant="info">
          {tct(
            'Until Sentry supports OAuth, you might want to switch to using [tokens:Personal Tokens] instead.',
            {
              tokens: <u />,
            }
          )}
        </AlertLink>
      </AlertLink.Container>
      <SimpleTable
        columns={API_KEY_COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Key')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Actions')}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {loading && <SimpleTable.Loading />}
        {!loading && !hasKeys && (
          <SimpleTable.Empty>{t('No API keys for this organization')}</SimpleTable.Empty>
        )}
        {!loading &&
          keys?.map(({id, key, label}) => {
            return (
              <SimpleTable.Row key={key}>
                <SimpleTable.RowCell>
                  <Link to={`/settings/${organization.slug}/api-keys/${id}/`}>
                    {label}
                  </Link>
                </SimpleTable.RowCell>

                <SimpleTable.RowCell>
                  <TextCopyInput size="md" monospace>
                    {key}
                  </TextCopyInput>
                </SimpleTable.RowCell>

                <SimpleTable.RowCell>
                  <Confirm
                    onConfirm={() => onRemove(id)}
                    message={t('Are you sure you want to remove this API key?')}
                  >
                    <Button variant="danger" size="sm" icon={<IconDelete />}>
                      {t('Remove API Key')}
                    </Button>
                  </Confirm>
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            );
          })}
      </SimpleTable>
    </div>
  );
}
