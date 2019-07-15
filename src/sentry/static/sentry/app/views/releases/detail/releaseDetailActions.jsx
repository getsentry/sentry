import PropTypes from 'prop-types';
import React from 'react';
import {browserHistory} from 'react-router';

import {t} from 'app/locale';
import {addErrorMessage, addLoadingMessage} from 'app/actionCreators/indicator';
import SentryTypes from 'app/sentryTypes';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';

import {deleteRelease} from './utils';

export default class ReleaseDetailsActions extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    // Provided in the project release page only
    projectId: PropTypes.string,
    release: SentryTypes.Release.isRequired,
  };

  handleDelete = () => {
    const {orgId, projectId, release} = this.props;
    const redirectPath = projectId
      ? `/${orgId}/${projectId}/releases/`
      : `/organizations/${orgId}/releases/`;
    addLoadingMessage(t('Deleting Release...'));

    deleteRelease(orgId, release.version)
      .then(() => {
        browserHistory.push(redirectPath);
      })
      .catch(() => {
        addErrorMessage(
          t('This release is referenced by active issues and cannot be removed.')
        );
      });
  };

  render() {
    return (
      <div className="m-b-1">
        <div className="btn-group">
          <Confirm
            onConfirm={this.handleDelete}
            message={t(
              'Deleting this release is permanent. Are you sure you wish to continue?'
            )}
          >
            <Button size="small" icon="icon-trash">
              {t('Delete')}
            </Button>
          </Confirm>
        </div>
      </div>
    );
  }
}
