import PropTypes from 'prop-types';
import React from 'react';
import {Params} from 'react-router/lib/Router';

import {Repository, RepositoryStatus} from 'app/types';
import {Client} from 'app/api';
import {t, tct} from 'app/locale';
import AlertLink from 'app/components/alertLink';
import Button from 'app/components/button';
import RepositoryRow from 'app/components/repositoryRow';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {IconCommit} from 'app/icons';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

type Props = {
  itemList: Repository[];
  onRepositoryChange: (data: {id: string; status: RepositoryStatus}) => void;
  api: Client;
  params: Params;
};

const OrganizationRepositories = ({itemList, onRepositoryChange, api, params}: Props) => {
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
          <PanelHeader>{t('Added Repositories')}</PanelHeader>
          <PanelBody>
            <div>
              {itemList.map(repo => (
                <RepositoryRow
                  key={repo.id}
                  repository={repo}
                  api={api}
                  showProvider
                  orgId={orgId}
                  onRepositoryChange={onRepositoryChange}
                />
              ))}
            </div>
          </PanelBody>
        </Panel>
      ) : (
        <Panel>
          <EmptyMessage
            icon={<IconCommit size="xl" />}
            title={t('Sentry is better with commit data')}
            description={t(
              'Adding one or more repositories will enable enhanced releases and the ability to resolve Sentry Issues via git message.'
            )}
            action={
              <Button href="https://docs.sentry.io/learn/releases/">
                {t('Learn more')}
              </Button>
            }
          />
        </Panel>
      )}
    </div>
  );
};

OrganizationRepositories.propTypes = {
  itemList: PropTypes.array,
  api: PropTypes.object,
  onRepositoryChange: PropTypes.func,
};

export default OrganizationRepositories;
