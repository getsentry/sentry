import React from 'react';
import styled from '@emotion/styled';

import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
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
          'Select a project to view events as a % of sessions. This helps you get a better picture of how these errors affect your users.'
        );
        disabled = true;
      } else if (!hasSessions) {
        tooltipText = t('The selected project does not have session data');
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
          delay={500}
          title={tooltipText}
          disabled={!tooltipText}
        >
          {getDisplayLabel(key)}
        </StyledTooltip>
      </DropdownItem>
    );
  };

  return (
    <StyledDropdownControl
      buttonProps={{prefix: t('Display')}}
      label={getDisplayLabel(display)}
    >
      <React.Fragment>
        {getMenuItem(IssueDisplayOptions.EVENTS)}
        {getMenuItem(IssueDisplayOptions.SESSIONS)}
      </React.Fragment>
    </StyledDropdownControl>
  );
};

const StyledDropdownControl = styled(DropdownControl)`
  margin-right: ${space(1)};
`;

const StyledTooltip = styled(Tooltip)`
  width: 100%;
`;

export default IssueListDisplayOptions;
