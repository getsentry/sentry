import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t, tct} from '../../../../locale';
import Button from '../../../../components/buttons/button';
import EmptyMessage from '../../components/emptyMessage';
import ExternalLink from '../../../../components/externalLink';
import Link from '../../../../components/link';
import LinkWithConfirmation from '../../../../components/linkWithConfirmation';
import Panel from '../../components/panel';
import PanelBody from '../../components/panelBody';
import PanelHeader from '../../components/panelHeader';
import PanelItem from '../../components/panelItem';
import SettingsPageHeader from '../../components/settingsPageHeader';
import recreateRoute from '../../../../utils/recreateRoute';

const PlusIcon = styled.span`
  margin-right: 4px;
`;

const TextBlock = styled.p`
  line-height: 1.8;
`;

class OrganizationApiKeysList extends React.Component {
  static propTypes = {
    routes: PropTypes.array,
    keys: PropTypes.array,
    busy: PropTypes.bool,
    onRemove: PropTypes.func,
    onAddApiKey: PropTypes.func,
  };

  render() {
    let {params, routes, keys, busy, onAddApiKey, onRemove} = this.props;
    let hasKeys = keys && keys.length;

    let action = (
      <Button priority="link" busy={busy} disabled={busy} onClick={onAddApiKey}>
        <PlusIcon className="icon-plus" /> {t('New API Key')}
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
              api: <ExternalLink href="https://docs.sentry.io/hosted/api/" />,
            }
          )}
        </TextBlock>

        <div className="alert alert-block alert-info">
          {tct(
            'psst. Until Sentry supports OAuth, you might want to switch to using [tokens:Auth Tokens] instead.',
            {
              tokens: <Link to="/api/" />,
            }
          )}
        </div>

        <Panel>
          <PanelHeader disablePadding={true}>
            <Flex align="center">
              <Flex align="center" flex="1">
                <Box px={2} flex="1">
                  {t('Name')}
                </Box>
                <Box px={2} flex="2">
                  {t('Key')}
                </Box>
              </Flex>

              <Box px={2} w={100}>
                {t('Actions')}
              </Box>
            </Flex>
          </PanelHeader>

          <PanelBody>
            {!hasKeys && (
              <EmptyMessage>{t('No API keys for this organization')}</EmptyMessage>
            )}

            {keys &&
              keys.map(({id, key, label}) => {
                let apiDetailsUrl = recreateRoute(`${id}/`, {
                  params,
                  routes,
                });

                return (
                  <PanelItem align="center" p={0} py={1} key={id}>
                    <Flex align="center" flex="1">
                      <Box px={2} flex="1" align="center">
                        <Link to={apiDetailsUrl}>{label}</Link>
                      </Box>
                      <Box px={2} flex="2">
                        <div className="form-control disabled auto-select">{key}</div>
                      </Box>
                    </Flex>

                    <Box px={2} w={100}>
                      <LinkWithConfirmation
                        className="btn btn-default btn-sm"
                        onConfirm={e => onRemove(id, e)}
                        message={t('Are you sure you want to remove this API key?')}
                        title={t('Remove API Key?')}
                      >
                        <span className="icon-trash" />
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
