import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {t, tct} from 'app/locale';
import AlertLink from 'app/components/alertLink';
import Button from 'app/components/button';
import HeroIcon from 'app/components/heroIcon';
import RepositoryRow from 'app/components/repositoryRow';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

export default class OrganizationRepositories extends React.Component {
  static propTypes = {
    itemList: PropTypes.array,
    api: PropTypes.object,
    onRepositoryChange: PropTypes.func,
  };

  render() {
    const {params, itemList, api, onRepositoryChange} = this.props;
    const {orgId} = params;
    const hasItemList = itemList && itemList.length > 0;

    return (
      <div>
        <SettingsPageHeader title={t('Repositories')} />
        <AlertLink to={`/settings/${orgId}/integrations/`}>
          {t(
            'Want to add a repository to start tracking commits? Install or configure your version control integration here.'
          )}
        </AlertLink>
        {!hasItemList && (
          <div className="m-b-2">
            <TextBlock>
              {t(
                'Connecting a repository allows Sentry to capture commit data via webhooks. ' +
                  'This enables features like suggested assignees and resolving issues via commit message. ' +
                  "Once you've connected a repository, you can associate commits with releases via the API."
              )}
              &nbsp;
              {tct('See our [link:documentation] for more details.', {
                link: <a href="https://docs.sentry.io/learn/releases/" />,
              })}
            </TextBlock>
          </div>
        )}

        {hasItemList ? (
          <Panel>
            <PanelHeader disablePadding>
              <Flex>
                <Box px={2}>{t('Added Repositories')}</Box>
              </Flex>
            </PanelHeader>
            <PanelBody>
              <Box>
                {itemList.map(repo => {
                  return (
                    <RepositoryRow
                      key={repo.id}
                      repository={repo}
                      api={api}
                      showProvider
                      orgId={orgId}
                      onRepositoryChange={onRepositoryChange}
                    />
                  );
                })}
              </Box>
            </PanelBody>
          </Panel>
        ) : (
          <Panel className="align-center p-x-2 p-y-1">
            <Box mb={1}>
              <HeroIcon src="icon-commit" />
            </Box>
            <h3>{t('Sentry is better with commit data')}</h3>
            <TextBlock>
              {t(
                'Adding one or more repositories will enable enhanced releases and the ability to resolve Sentry Issues via git message.'
              )}
            </TextBlock>
            <Box mb={1}>
              <Button href="https://docs.sentry.io/learn/releases/">
                {t('Learn more')}
              </Button>
            </Box>
          </Panel>
        )}
      </div>
    );
  }
}
