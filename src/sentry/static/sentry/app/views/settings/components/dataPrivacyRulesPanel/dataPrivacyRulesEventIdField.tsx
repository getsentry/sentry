import React from 'react';
import styled from '@emotion/styled';

import TextField from 'app/components/forms/textField';
import ControlState from 'app/views/settings/components/forms/field/controlState';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';

export enum EventIdFieldStatus {
  NONE = 'none',
  LOADING = 'loading',
  INVALID = 'invalid',
  NOT_FOUND = 'not_found',
  LOADED = 'loaded',
  ERROR = 'error',
}

type Props = {
  status: EventIdFieldStatus;
  onChange: (eventId: string) => void;
  onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  value: string;
};

const DataPrivacyRulesEventIdField = ({
  status,
  onChange,
  value,
  onBlur,
  onKeyDown,
  disabled,
}: Props) => {
  const getEventTooltipTitle = (): string => {
    switch (status) {
      case EventIdFieldStatus.INVALID:
        return t("That's not a valid event ID");
      case EventIdFieldStatus.ERROR:
        return t('Something went wrong while fetching the suggestions');
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
      <TooltipContent>
        <StyledTextField
          name="eventId"
          disabled={disabled}
          value={value}
          placeholder={t('Paste event ID for better assistance')}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
        />
        {status === EventIdFieldStatus.LOADING && <ControlState isSaving />}
        {status === EventIdFieldStatus.INVALID && <ControlState error />}
        {status === EventIdFieldStatus.ERROR && <ControlState error />}
        {status === EventIdFieldStatus.NOT_FOUND && <ControlState error />}
      </TooltipContent>
    </Tooltip>
  );
};

export default DataPrivacyRulesEventIdField;

const TooltipContent = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  padding-bottom: ${space(1)};
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: 300px 1fr;
    padding-bottom: 0px;
  }
`;

const StyledTextField = styled(TextField)`
  flex: 1;
  font-weight: 400;
  input {
    height: 34px;
  }
  :first-child {
    margin-bottom: 0;
  }
`;
