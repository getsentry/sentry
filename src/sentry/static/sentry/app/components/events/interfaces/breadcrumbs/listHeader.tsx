import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import {IconSwitch} from 'app/icons';

import {GridCell} from './styles';

const getTimeTooltipTitle = (displayRelativeTime: boolean) => {
  if (displayRelativeTime) {
    return t('Switch to absolute');
  }
  return t('Switch to relative');
};

type Props = {
  onSwitchTimeFormat: () => void;
  displayRelativeTime: boolean;
};

const ListHeader = React.memo(({onSwitchTimeFormat, displayRelativeTime}: Props) => (
  <React.Fragment>
    <StyledGridCell>{t('Type')}</StyledGridCell>
    <Category>{t('Category')}</Category>
    <StyledGridCell>{t('Description')}</StyledGridCell>
    <StyledGridCell>{t('Level')}</StyledGridCell>
    <Time onClick={onSwitchTimeFormat}>
      <Tooltip title={getTimeTooltipTitle(displayRelativeTime)}>
        <StyledIconSwitch size="xs" />
      </Tooltip>
      <span> {t('Time')}</span>
    </Time>
  </React.Fragment>
));

export default ListHeader;

const StyledGridCell = styled(GridCell)`
  position: sticky;
  z-index: ${p => p.theme.zIndex.breadcrumbs.header};
  top: 0;
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.gray100};
  color: ${p => p.theme.gray600};
  font-weight: 600;
  text-transform: uppercase;
  line-height: 1;
  font-size: ${p => p.theme.fontSizeExtraSmall};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding: ${space(2)} ${space(2)};
    font-size: ${p => p.theme.fontSizeSmall};
  }
`;

const Category = styled(StyledGridCell)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-left: ${space(1)};
  }
`;

const Time = styled(StyledGridCell)`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
  cursor: pointer;
`;

const StyledIconSwitch = styled(IconSwitch)`
  transition: 0.15s color;
  &:hover {
    color: ${p => p.theme.gray500};
  }
`;
