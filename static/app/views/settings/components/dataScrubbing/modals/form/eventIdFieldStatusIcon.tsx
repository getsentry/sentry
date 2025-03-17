import styled from '@emotion/styled';

import {ControlState} from 'sentry/components/forms/fieldGroup/controlState';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

import {EventIdStatus} from '../../types';

type Props = {
  onClickIconClose: () => void;
  status?: EventIdStatus;
};

function EventIdFieldStatusIcon({status, onClickIconClose}: Props) {
  switch (status) {
    case EventIdStatus.ERROR:
    case EventIdStatus.INVALID:
    case EventIdStatus.NOT_FOUND:
      return (
        <CloseIcon onClick={onClickIconClose}>
          <Tooltip title={t('Clear event ID')}>
            <StyledIconClose size="xs" />
          </Tooltip>
        </CloseIcon>
      );
    case EventIdStatus.LOADING:
      return <ControlState isSaving />;
    case EventIdStatus.LOADED:
      return <IconCheckmark color="successText" />;
    default:
      return null;
  }
}

export default EventIdFieldStatusIcon;

const CloseIcon = styled('div')`
  :first-child {
    line-height: 0;
  }
`;

const StyledIconClose = styled(IconClose)`
  color: ${p => p.theme.gray200};
  :hover {
    color: ${p => p.theme.gray300};
  }
  cursor: pointer;
`;
