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

const getEventTooltipTitle = (status: EventIdFieldStatus): string => {
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

const DataPrivacyRulesEventIdField = ({
  status,
  onChange,
  value,
  onBlur,
  onKeyDown,
  disabled,
}: Props) => (
  <Tooltip isHoverable title={getEventTooltipTitle(status)}>
    <TooltipContent>
      <StyledTextField
        name="eventId"
        disabled={disabled}
        value={value}
        placeholder={t('Paste event ID for better assistance')}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        showStatus={
          status !== EventIdFieldStatus.LOADED && status !== EventIdFieldStatus.NONE
        }
      />
      <Status>
        {status === EventIdFieldStatus.LOADING && <ControlState isSaving />}
        {status === EventIdFieldStatus.INVALID && <ControlState error />}
        {status === EventIdFieldStatus.ERROR && <ControlState error />}
        {status === EventIdFieldStatus.NOT_FOUND && <ControlState error />}
      </Status>
    </TooltipContent>
  </Tooltip>
);

export default DataPrivacyRulesEventIdField;

const TooltipContent = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  padding-bottom: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    padding-bottom: 0px;
  }
`;

const StyledTextField = styled(TextField)<{showStatus: boolean}>`
  flex: 1;
  font-weight: 400;
  input {
    height: 34px;
    padding-right: ${p => (p.showStatus ? space(4) : space(1.5))};
  }
  :first-child {
    margin-bottom: 0;
  }
`;

const Status = styled('div')`
  position: absolute;
  right: 0;
`;
