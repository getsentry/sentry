import PropTypes from 'prop-types';
import React from 'react';

import {t, tct} from '../locale';
import Button from '../components/buttons/button';
import Confirm from '../components/confirm';
import DropdownLink from '../components/dropdownLink';
import MenuItem from '../components/menuItem';
import AddRepositoryLink from './settings/organization/repositories/addRepositoryLink';

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

    return (
      <div>
        <div className="pull-right">
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
        </div>
        <h3 className="m-b-2">{t('Repositories')}</h3>
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
        {hasItemList ? (
          <div className="panel panel-default">
            <table className="table">
              <tbody>
                {itemList.map(repo => {
                  let repoIsVisible = repo.status === 'visible';
                  return (
                    <tr key={repo.id}>
                      <td>
                        <strong>{repo.name}</strong>
                        {!repoIsVisible && <small> — {this.getStatusLabel(repo)}</small>}
                        {repo.status === 'pending_deletion' && (
                          <small>
                            {' '}
                            (
                            <a onClick={() => onCancelDelete(repo)}>{t('Cancel')}</a>
                            )
                          </small>
                        )}
                        <br />
                        <small>{repo.provider.name}</small>
                        {repo.url && (
                          <small>
                            {' '}
                            — <a href={repo.url}>{repo.url}</a>
                          </small>
                        )}
                      </td>
                      <td style={{width: 60}}>
                        <Confirm
                          disabled={!repoIsVisible}
                          onConfirm={() => onDeleteRepo(repo)}
                          message={t('Are you sure you want to remove this repository?')}
                        >
                          <Button size="xsmall">
                            <span className="icon icon-trash" />
                          </Button>
                        </Confirm>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
