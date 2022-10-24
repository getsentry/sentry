import {Fragment} from 'react';
import {PlainRoute, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import AlertLink from 'sentry/components/alertLink';
import Button from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LinkWithConfirmation from 'sentry/components/links/linkWithConfirmation';
import {PanelTable} from 'sentry/components/panels';
import TextCopyInput from 'sentry/components/textCopyInput';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import recreateRoute from 'sentry/utils/recreateRoute';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {DeprecatedApiKey} from './types';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  /**
   * Busy differs from loading in that busy is a result of an action like removing
   */
  busy: boolean;
  keys: DeprecatedApiKey[];

  /**
   * Loading refers to fetching the API Keys
   */
  loading: boolean;

  onAddApiKey: () => {};

  onRemove: (id: DeprecatedApiKey['id']) => {};
  routes: PlainRoute[];
};

function OrganizationApiKeysList({
  params,
  routes,
  keys,
  busy,
  loading,
  onAddApiKey,
  onRemove,
}: Props) {
  const hasKeys = keys && keys.length;

  const action = (
    <Button
      priority="primary"
      size="sm"
      icon={<IconAdd size="xs" isCircled />}
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
          'Until Sentry supports OAuth, you might want to switch to using [tokens:Auth Tokens] instead.',
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
        {keys &&
          keys.map(({id, key, label}) => {
            const apiDetailsUrl = recreateRoute(`${id}/`, {
              params,
              routes,
            });

            return (
              <Fragment key={key}>
                <Cell>
                  <Link to={apiDetailsUrl}>{label}</Link>
                </Cell>

                <TextCopyInput size="sm" monospace>
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
                    <IconDelete size="xs" css={{position: 'relative', top: '2px'}} />
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
