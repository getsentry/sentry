import React from 'react';
import {RouteComponentProps} from 'react-router';
import {PlainRoute} from 'react-router/lib/Route';
import styled from '@emotion/styled';

import AlertLink from 'app/components/alertLink';
import AutoSelectText from 'app/components/autoSelectText';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import Link from 'app/components/links/link';
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import {PanelTable} from 'app/components/panels';
import {IconAdd, IconDelete} from 'app/icons';
import {t, tct} from 'app/locale';
import {inputStyles} from 'app/styles/input';
import recreateRoute from 'app/utils/recreateRoute';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

import {DeprecatedApiKey} from './types';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  routes: PlainRoute[];
  keys: DeprecatedApiKey[];

  /**
   * Loading refers to fetching the API Keys
   */
  loading: boolean;

  /**
   * Busy differs from loading in that busy is a result of an action like removing
   */
  busy: boolean;

  onRemove: (id: DeprecatedApiKey['id']) => {};
  onAddApiKey: () => {};
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
      size="small"
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
              <React.Fragment key={key}>
                <Cell>
                  <Link to={apiDetailsUrl}>{label}</Link>
                </Cell>

                <div>
                  <AutoSelectTextInput readOnly>{key}</AutoSelectTextInput>
                </div>

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
              </React.Fragment>
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

const AutoSelectTextInput = styled(AutoSelectText)<{readOnly: boolean}>`
  ${p => inputStyles(p)}
`;

export default OrganizationApiKeysList;
