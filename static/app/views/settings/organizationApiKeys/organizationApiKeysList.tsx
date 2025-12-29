import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';

import Confirm from 'sentry/components/confirm';
import {AlertLink} from 'sentry/components/core/alert/alertLink';
import {Button} from 'sentry/components/core/button';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {PanelTable} from 'sentry/components/panels/panelTable';
import TextCopyInput from 'sentry/components/textCopyInput';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

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

function OrganizationApiKeysList({
  organization,
  keys,
  busy,
  loading,
  onAddApiKey,
  onRemove,
}: Props) {
  const hasKeys = Boolean(keys?.length);

  const action = (
    <Button
      priority="primary"
      size="sm"
      icon={<IconAdd />}
      busy={busy}
      disabled={busy}
      onClick={onAddApiKey}
    >
      {t('New API Key')}
    </Button>
  );

  return (
    <div>
      <SettingsPageHeader title={t('API Keys')} action={action} />

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
        <AlertLink to="/settings/account/api/auth-tokens/" type="info">
          {tct(
            'Until Sentry supports OAuth, you might want to switch to using [tokens:Personal Tokens] instead.',
            {
              tokens: <u />,
            }
          )}
        </AlertLink>
      </AlertLink.Container>
      <PanelTable
        isLoading={loading}
        isEmpty={!hasKeys}
        emptyMessage={t('No API keys for this organization')}
        headers={[t('Name'), t('Key'), t('Actions')]}
      >
        {keys?.map(({id, key, label}) => {
          return (
            <Fragment key={key}>
              <Flex align="center">
                <Link to={`/settings/${organization.slug}/api-keys/${id}/`}>{label}</Link>
              </Flex>

              <TextCopyInput size="md" monospace>
                {key}
              </TextCopyInput>

              <Flex align="center">
                <Confirm
                  onConfirm={() => onRemove(id)}
                  message={t('Are you sure you want to remove this API key?')}
                >
                  <Button priority="danger" size="sm" icon={<IconDelete />}>
                    {t('Remove API Key')}
                  </Button>
                </Confirm>
              </Flex>
            </Fragment>
          );
        })}
      </PanelTable>
    </div>
  );
}

export default OrganizationApiKeysList;
