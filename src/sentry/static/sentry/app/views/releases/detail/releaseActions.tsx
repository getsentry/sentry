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
import Tooltip from 'app/components/tooltip';

import {deleteRelease} from './utils';

type Props = {
  orgId: string;
  version: string;
  hasHealthData: boolean;
};

const ReleaseActions = ({orgId, version, hasHealthData}: Props) => {
  const handleDelete = async () => {
    const redirectPath = `/organizations/${orgId}/releases/`;
    addLoadingMessage(t('Deleting Release...'));

    try {
      await deleteRelease(orgId, version);
      addSuccessMessage(t('Release was successfully removed.'));
      browserHistory.push(redirectPath);
    } catch (error) {
      const errorMessage =
        error.responseJSON?.detail ?? t('Release could not be be removed.');
      addErrorMessage(errorMessage);
    }
  };

  return (
    <Wrapper>
      <Confirm
        onConfirm={handleDelete}
        message={t(
          'Deleting this release is permanent and will affect other projects associated with it. Are you sure you wish to continue?'
        )}
      >
        <div>
          <Tooltip
            title={t(
              'You can only delete releases if they have no issues or health data.'
            )}
            disabled={!hasHealthData}
          >
            <Button icon={<IconDelete />} disabled={hasHealthData} />
          </Tooltip>
        </div>
      </Confirm>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: min-content;
  grid-gap: ${space(0.5)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: 100%;
    margin: ${space(1)} 0 ${space(2)} 0;
  }
`;

export default ReleaseActions;
