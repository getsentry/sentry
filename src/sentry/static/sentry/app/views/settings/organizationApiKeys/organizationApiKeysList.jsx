import {Box, Flex} from 'reflexbox';
import PropTypes from 'prop-types';
import React from 'react';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t, tct} from 'app/locale';
import AutoSelectText from 'app/components/autoSelectText';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ExternalLink from 'app/components/links/externalLink';
import {IconDelete, IconAdd} from 'app/icons';
import Link from 'app/components/links/link';
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import recreateRoute from 'app/utils/recreateRoute';

class OrganizationApiKeysList extends React.Component {
  static propTypes = {
    routes: PropTypes.array,
    keys: PropTypes.array,
    busy: PropTypes.bool,
    onRemove: PropTypes.func,
    onAddApiKey: PropTypes.func,
  };

  render() {
    const {params, routes, keys, busy, onAddApiKey, onRemove} = this.props;
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

        <div className="alert alert-block alert-info">
          {tct(
            'psst. Until Sentry supports OAuth, you might want to switch to using [tokens:Auth Tokens] instead.',
            {
              tokens: <Link to="/settings/account/api/auth-tokens/" />,
            }
          )}
        </div>

        <Panel>
          <PanelHeader disablePadding>
            <Flex alignItems="center" flex="1">
              <Box px={2} flex="1">
                {t('Name')}
              </Box>
              <Box px={2} flex="2">
                {t('Key')}
              </Box>
            </Flex>

            <Box px={2} width={100}>
              {t('Actions')}
            </Box>
          </PanelHeader>

          <PanelBody>
            {!hasKeys && (
              <EmptyMessage>{t('No API keys for this organization')}</EmptyMessage>
            )}

            {keys &&
              keys.map(({id, key, label}) => {
                const apiDetailsUrl = recreateRoute(`${id}/`, {
                  params,
                  routes,
                });

                return (
                  <PanelItem alignItems="center" p={0} py={1} key={id}>
                    <Flex alignItems="center" flex="1">
                      <Box px={2} flex="1" alignItems="center">
                        <Link to={apiDetailsUrl}>{label}</Link>
                      </Box>
                      <Box px={2} flex="2">
                        <AutoSelectText className="form-control disabled">
                          {key}
                        </AutoSelectText>
                      </Box>
                    </Flex>

                    <Box px={2} width={100}>
                      <LinkWithConfirmation
                        className="btn btn-default btn-sm"
                        onConfirm={e => onRemove(id, e)}
                        message={t('Are you sure you want to remove this API key?')}
                        title={t('Remove API Key?')}
                      >
                        <IconDelete size="xs" css={{position: 'relative', top: '2px'}} />
                      </LinkWithConfirmation>
                    </Box>
                  </PanelItem>
                );
              })}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default OrganizationApiKeysList;
