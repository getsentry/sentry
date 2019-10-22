import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import {PanelItem} from 'app/components/panels';
import {t, tct} from 'app/locale';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import Tag from 'app/views/settings/components/tag';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

const InviteRequestRow = ({
  orgId,
  inviteRequest: {id, email, inviterName, inviteStatus},
  inviteRequestBusy,
  onApprove,
  onDeny,
}) => {
  return (
    <StyledPanel>
      <div>
        <h5 style={{margin: '0 0 3px'}}>
          <UserName>{email}</UserName>
        </h5>
        {inviteStatus === 'requested_to_be_invited' ? (
          inviterName && (
            <Description>{tct('Requested by [inviterName]', {inviterName})}</Description>
          )
        ) : (
          <Tooltip title={tct('[email] requested to join [orgId].', {email, orgId})}>
            <Tag>{t('EXTERNAL REQUEST')}</Tag>
          </Tooltip>
        )}
      </div>
      <ButtonGroup>
        <Confirm
          onConfirm={() => onApprove(id, email)}
          message={tct('Are you sure you want to invite [email] to [orgId]?', {
            email,
            orgId,
          })}
        >
          <Button priority="primary" size="small" busy={inviteRequestBusy.get(id)}>
            {t('Approve')}
          </Button>
        </Confirm>
        <Button
          size="small"
          busy={inviteRequestBusy.get(id)}
          onClick={() => onDeny(id, email)}
        >
          {t('Deny')}
        </Button>
      </ButtonGroup>
    </StyledPanel>
  );
};

InviteRequestRow.propTypes = {
  orgId: PropTypes.string,
  inviteRequest: PropTypes.shape({
    email: PropTypes.string,
    id: PropTypes.string,
    inviterName: PropTypes.string,
    inviteStatus: PropTypes.string,
  }),
  onApprove: PropTypes.func,
  onDeny: PropTypes.func,
  inviteRequestBusy: PropTypes.object,
};

const StyledPanel = styled(PanelItem)`
  display: grid;
  grid-template-columns: auto max-content;
  grid-gap: ${space(1)};
  align-items: center;
`;

const UserName = styled('div')`
  font-size: 16px;
`;

const Description = styled('div')`
  color: ${p => p.theme.gray3};
  font-size: 14px;
`;

const ButtonGroup = styled('div')`
  display: inline-grid;
  grid-template-columns: auto auto;
  grid-gap: ${space(0.5)};
`;

export default InviteRequestRow;
