import React from 'react';
import styled from '@emotion/styled';

import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {getDisplayLabel, IssueDisplayOptions} from 'app/views/issueList/utils';

type Props = {
  onDisplayChange: (display: string) => void;
  display: IssueDisplayOptions;
  hasSessions: boolean;
  hasMultipleProjectsSelected: boolean;
};

const IssueListDisplayOptions = ({
  onDisplayChange,
  display,
  hasSessions,
  hasMultipleProjectsSelected,
}: Props) => {
  const getMenuItem = (key: IssueDisplayOptions): React.ReactNode => {
    let tooltipText: string | undefined;
    let disabled = false;
    if (key === IssueDisplayOptions.SESSIONS) {
      if (hasMultipleProjectsSelected) {
        tooltipText = t(
          'This option is not available when multiple projects are selected.'
        );
        disabled = true;
      } else if (!hasSessions) {
        tooltipText = t(
          'This option is not available because there is no session data in the selected time period.'
        );
        disabled = true;
      }
    }

    return (
      <DropdownItem
        onSelect={onDisplayChange}
        eventKey={key}
        isActive={key === display}
        disabled={disabled}
      >
        <StyledTooltip
          containerDisplayMode="block"
          position="top"
          title={tooltipText}
          disabled={!tooltipText}
        >
          {getDisplayLabel(key)}
        </StyledTooltip>
      </DropdownItem>
    );
  };

  return (
    <DropdownControl
      buttonProps={{prefix: t('Display')}}
      buttonTooltipTitle={
        display === IssueDisplayOptions.SESSIONS
          ? t(
              'This shows the event count as a percent of sessions in the same time period.'
            )
          : null
      }
      label={getDisplayLabel(display)}
    >
      <React.Fragment>
        {getMenuItem(IssueDisplayOptions.EVENTS)}
        {getMenuItem(IssueDisplayOptions.SESSIONS)}
      </React.Fragment>
    </DropdownControl>
  );
};

const StyledTooltip = styled(Tooltip)`
  width: 100%;
`;

export default IssueListDisplayOptions;
