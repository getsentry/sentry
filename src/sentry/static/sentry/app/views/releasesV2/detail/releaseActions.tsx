import React from 'react';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';

import {t} from 'app/locale';
import space from 'app/styles/space';
import Button from 'app/components/button';
import {IconDelete} from 'app/icons';
import Confirm from 'app/components/confirm';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';

import {deleteRelease} from './utils';

type Props = {
  orgId: string;
  version: string;
};

const ReleaseActions = ({orgId, version}: Props) => {
  const handleDelete = async () => {
    const redirectPath = `/organizations/${orgId}/releases-v2/`;
    addLoadingMessage(t('Deleting Release...'));

    try {
      await deleteRelease(orgId, version);
      addSuccessMessage(t('Release was successfully removed.'));
      browserHistory.push(redirectPath);
    } catch {
      addErrorMessage(
        t('This release is referenced by active issues and cannot be removed.')
      );
    }
  };

  return (
    <Wrapper>
      <Confirm
        onConfirm={handleDelete}
        message={t(
          'Deleting this release is permanent. Are you sure you wish to continue?'
        )}
      >
        <Button>
          <IconDelete size="xs" />
        </Button>
      </Confirm>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: min-content;
  grid-gap: ${space(0.5)};
`;

export default ReleaseActions;
