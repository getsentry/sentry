import {Box, Flex} from 'grid-emotion';
import {withTheme} from 'emotion-theming';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t, tct} from '../../../../locale';
import Button from '../../../../components/buttons/button';
import Confirm from '../../../../components/confirm';
import DropdownLink from '../../../../components/dropdownLink';
import MenuItem from '../../../../components/menuItem';
import SpreadLayout from '../../../../components/spreadLayout';
import Panel from '../../components/panel';
import PanelBody from '../../components/panelBody';
import PanelHeader from '../../components/panelHeader';
import SettingsPageHeader from '../../components/settingsPageHeader';
import AddRepositoryLink from './addRepositoryLink';

const RepoRow = withTheme(styled(SpreadLayout)`
  border-bottom: 1px solid ${p => p.theme.borderLight};

  &:last-child {
    border-bottom: none;
  }
`);

class OrganizationRepositories extends React.Component {
  static propTypes = {
    itemList: PropTypes.array,
    repoConfig: PropTypes.object,
    onAddRepo: PropTypes.func,
    onCancelDelete: PropTypes.func,
    onDeleteRepo: PropTypes.func,
  };

  getStatusLabel(repo) {
    switch (repo.status) {
      case 'pending_deletion':
        return 'Deletion Queued';
      case 'deletion_in_progress':
        return 'Deletion in Progress';
      case 'hidden':
        return 'Disabled';
      default:
        return null;
    }
  }

  render() {
    let {
      params,
      itemList,
      repoConfig,
      onAddRepo,
      onCancelDelete,
      onDeleteRepo,
    } = this.props;
    let {orgId} = params;
    let hasItemList = itemList && itemList.length > 0;

    // let action = (
    //   <Button priority="link" onClick={onAddRepo}>
    //   </Button>
    // );

    return (
      <div>
        <SettingsPageHeader
          label={t('Repositories')}
          action={
            <DropdownLink
              anchorRight
              className="btn btn-primary btn-sm"
              title={t('Add Repository')}
            >
              {repoConfig &&
                repoConfig.providers &&
                repoConfig.providers.map(provider => {
                  return (
                    <MenuItem noAnchor={true} key={provider.id}>
                      <AddRepositoryLink
                        provider={provider}
                        orgId={orgId}
                        onSuccess={onAddRepo}
                      />
                    </MenuItem>
                  );
                })}
            </DropdownLink>
          }
        />

        {hasItemList && (
          <div className="m-b-2">
            <p>
              {t(
                'Connecting a repository allows Sentry to capture commit data via webhooks. ' +
                  'This enables features like suggested assignees and resolving issues via commit message. ' +
                  "Once you've connected a repository, you can associate commits with releases via the API."
              )}
              &nbsp;
              {tct('See our [link:documentation] for more details.', {
                link: <a href="https://docs.sentry.io/learn/releases/" />,
              })}
            </p>
          </div>
        )}

        {!hasItemList ? (
          <Panel>
            <PanelHeader disablePadding={true}>
              <Flex>
                <Box px={2}>{t('Added Repositories')}</Box>
              </Flex>
            </PanelHeader>
            <PanelBody>
              <Box>
                {itemList.map(repo => {
                  let repoIsVisible = repo.status === 'visible';
                  return (
                    <RepoRow key={repo.id}>
                      <Box p={2} flex="1">
                        <Flex direction="column">
                          <Box pb={1}>
                            <strong>{repo.name}</strong>
                            {!repoIsVisible && (
                              <small> — {this.getStatusLabel(repo)}</small>
                            )}
                            {repo.status === 'pending_deletion' && (
                              <small>
                                {' '}
                                (
                                <a onClick={() => onCancelDelete(repo)}>{t('Cancel')}</a>
                                )
                              </small>
                            )}
                          </Box>
                          <Box>
                            <small>{repo.provider.name}</small>
                            {repo.url && (
                              <small>
                                {' '}
                                — <a href={repo.url}>{repo.url}</a>
                              </small>
                            )}
                          </Box>
                        </Flex>
                      </Box>

                      <Box p={2}>
                        <Confirm
                          disabled={!repoIsVisible}
                          onConfirm={() => onDeleteRepo(repo)}
                          message={t('Are you sure you want to remove this repository?')}
                        >
                          <Button size="xsmall">
                            <span className="icon icon-trash" />
                          </Button>
                        </Confirm>
                      </Box>
                    </RepoRow>
                  );
                })}
              </Box>
            </PanelBody>
          </Panel>
        ) : (
          <div className="well blankslate align-center p-x-2 p-y-1">
            <div className="icon icon-lg icon-git-commit" />
            <h3>{t('Sentry is better with commit data')}</h3>
            <p>
              {t(
                'Adding one or more repositories will enable enhanced releases and the ability to resolve Sentry Issues via git message.'
              )}
            </p>
            <p className="m-b-1">
              <a
                className="btn btn-default"
                href="https://docs.sentry.io/learn/releases/"
              >
                Learn more
              </a>
            </p>
          </div>
        )}
      </div>
    );
  }
}

export default OrganizationRepositories;
