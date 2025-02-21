import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import AlertLink from 'sentry/components/core/alertLink';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LinkWithConfirmation from 'sentry/components/links/linkWithConfirmation';
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
      icon={<IconAdd isCircled />}
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

      <AlertLink to="/settings/account/api/auth-tokens/" priority="info">
        {tct(
          'Until Sentry supports OAuth, you might want to switch to using [tokens:User Auth Tokens] instead.',
          {
            tokens: <u />,
          }
        )}
      </AlertLink>

      <PanelTable
        isLoading={loading}
        isEmpty={!hasKeys}
        emptyMessage={t('No API keys for this organization')}
        headers={[t('Name'), t('Key'), t('Actions')]}
      >
        {keys?.map(({id, key, label}) => {
          return (
            <Fragment key={key}>
              <Cell>
                <Link to={`/settings/${organization.slug}/api-keys/${id}/`}>{label}</Link>
              </Cell>

              <TextCopyInput size="md" monospace>
                {key}
              </TextCopyInput>

              <Cell>
                <LinkWithConfirmation
                  aria-label={t('Remove API Key')}
                  className="btn btn-default btn-sm"
                  onConfirm={() => onRemove(id)}
                  message={t('Are you sure you want to remove this API key?')}
                  title={t('Remove API Key?')}
                >
                  <IconDelete
                    size="xs"
                    css={css`
                      position: relative;
                      top: 2px;
                    `}
                  />
                </LinkWithConfirmation>
              </Cell>
            </Fragment>
          );
        })}
      </PanelTable>
    </div>
  );
}

const Cell = styled('div')`
  display: flex;
  align-items: center;
`;

export default OrganizationApiKeysList;
