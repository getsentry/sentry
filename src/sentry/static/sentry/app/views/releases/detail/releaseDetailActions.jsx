import PropTypes from 'prop-types';
import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {addErrorMessage, addLoadingMessage} from 'app/actionCreators/indicator';
import SentryTypes from 'app/sentryTypes';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {IconDelete} from 'app/icons';
import Feature from 'app/components/acl/feature';
import SwitchReleasesButton from 'app/views/releasesV2/utils/switchReleasesButton';
import ButtonBar from 'app/components/buttonBar';
import space from 'app/styles/space';

import {deleteRelease} from './utils';

export default class ReleaseDetailsActions extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    release: SentryTypes.Release.isRequired,
  };

  handleDelete = () => {
    const {orgId, release} = this.props;
    const redirectPath = `/organizations/${orgId}/releases/`;
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
    const {orgId} = this.props;

    return (
      <Wrapper>
        <ButtonBar gap={1}>
          <Confirm
            onConfirm={this.handleDelete}
            message={t(
              'Deleting this release is permanent. Are you sure you wish to continue?'
            )}
          >
            <Button size="small" icon={<IconDelete />}>
              {t('Delete')}
            </Button>
          </Confirm>

          <Feature features={['releases-v2']}>
            <SwitchReleasesButton version="2" orgId={orgId} />
          </Feature>
        </ButtonBar>
      </Wrapper>
    );
  }
}

const Wrapper = styled('div')`
  display: flex;
  justify-content: flex-start;
  margin-bottom: ${space(3)};
`;
