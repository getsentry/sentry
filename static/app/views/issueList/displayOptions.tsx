import React from 'react';
import styled from '@emotion/styled';

import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {getDisplayLabel, IssueDisplayOptions} from 'app/views/issueList/utils';

type Props = {
  onDisplayChange: (display: string) => void;
  display: IssueDisplayOptions;
};

const IssueListDisplayOptions = ({onDisplayChange, display}: Props) => {
  const getMenuItem = (key: IssueDisplayOptions): React.ReactNode => (
    <DropdownItem onSelect={onDisplayChange} eventKey={key} isActive={key === display}>
      {getDisplayLabel(key)}
    </DropdownItem>
  );

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

export default IssueListDisplayOptions;
