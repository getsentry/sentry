import {useRef, useState} from 'react';
import styled from '@emotion/styled';

import AlertLink from 'sentry/components/alertLink';
import {LinkButton} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import {InputGroup} from 'sentry/components/inputGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import RepositoryRow from 'sentry/components/repositoryRow';
import {IconCommit, IconSearch} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Repository, RepositoryStatus} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = {
  itemList: Repository[];
  onRepositoryChange: (data: {id: string; status: RepositoryStatus}) => void;
  organization: Organization;
};

function OrganizationRepositories({itemList, onRepositoryChange, organization}: Props) {
  const api = useApi();

  const hasItemList = itemList && itemList.length > 0;

  const searchInput = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const searchResults = itemList.filter(i => JSON.stringify(i).includes(searchTerm));

  return (
    <div>
      <SettingsPageHeader title={t('Repositories')} />
      <AlertLink to={`/settings/${organization.slug}/integrations/`}>
        {t(
          'Want to add a repository to start tracking commits? Install or configure your version control integration here.'
        )}
      </AlertLink>
      <StyledSearchBar>
        <InputGroup.LeadingItems disablePointerEvents>
          <IconSearch color="subText" size="xs" />
        </InputGroup.LeadingItems>
        <InputGroup.Input
          ref={searchInput}
          placeholder={t('Search repositories')}
          onChange={e => setSearchTerm(e.target.value.toLowerCase())}
        />
      </StyledSearchBar>
      {!hasItemList && (
        <div className="m-b-2">
          <TextBlock>
            {t(
              "Connecting a repository allows Sentry to capture commit data via webhooks. This enables features like suggested assignees and resolving issues via commit message. Once you've connected a repository, you can associate commits with releases via the API."
            )}
            &nbsp;
            {tct('See our [link:documentation] for more details.', {
              link: <ExternalLink href="https://docs.sentry.io/learn/releases/" />,
            })}
          </TextBlock>
        </div>
      )}

      {hasItemList ? (
        <Panel>
          <PanelHeader>{t('Added Repositories')}</PanelHeader>
          <PanelBody>
            <div>
              {searchResults.map(repo => (
                <RepositoryRow
                  api={api}
                  key={repo.id}
                  repository={repo}
                  showProvider
                  orgSlug={organization.slug}
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
              <LinkButton external href="https://docs.sentry.io/learn/releases/">
                {t('Learn more')}
              </LinkButton>
            }
          />
        </Panel>
      )}
    </div>
  );
}

const StyledSearchBar = styled(InputGroup)`
  margin-bottom: ${space(2)};
`;

export default OrganizationRepositories;
