import React from 'react';
import styled from '@emotion/styled';

import TextField from 'app/components/forms/textField';
import ControlState from 'app/views/settings/components/forms/field/controlState';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';

export enum EventIdFieldStatus {
  NONE,
  LOADING,
  INVALID,
  NOT_FOUND,
  LOADED,
}

type Props = {
  status: EventIdFieldStatus;
  onChange: (eventId: string) => void;
  onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  value: string;
};

const DataPrivacyRulesEventIdField = ({
  status,
  onChange,
  value,
  onBlur,
  disabled,
}: Props) => {
  const getEventTooltipTitle = (): string => {
    switch (status) {
      case EventIdFieldStatus.LOADING:
        return '';
      case EventIdFieldStatus.INVALID:
        return t("That's not a valid event ID");
      case EventIdFieldStatus.NOT_FOUND:
        return t('Event ID not found in projects you have access to');
      case EventIdFieldStatus.LOADED:
        return t('Auto-completing based on this event ID');
      default:
        return '';
    }
  };

  return (
    <Tooltip title={getEventTooltipTitle()}>
      <div>
        <StyledTextField
          name="eventId"
          disabled={disabled}
          value={value}
          placeholder={t('Paste event ID for better assistance')}
          onChange={onChange}
          onBlur={onBlur}
        />
        <Status>
          {status === EventIdFieldStatus.LOADING && <ControlState isSaving />}
          {status === EventIdFieldStatus.INVALID && <ControlState error />}
          {status === EventIdFieldStatus.NOT_FOUND && <ControlState error />}
        </Status>
      </div>
    </Tooltip>
  );
};

export default DataPrivacyRulesEventIdField;

const Status = styled('div')`
  position: absolute;
  right: ${space(0.5)};
  top: ${space(0.5)};
  bottom: ${space(0.5)};
  background: ${p => p.theme.white};
`;

const StyledTextField = styled(TextField)`
  font-weight: 400;
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    :first-child {
      margin-bottom: 0;
    }
  }
`;
