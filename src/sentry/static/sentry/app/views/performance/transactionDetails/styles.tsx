import React from 'react';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import {SectionHeading} from 'app/components/charts/styles';
import MenuItem from 'app/components/menuItem';
import QuestionTooltip from 'app/components/questionTooltip';
import Tag, {Background} from 'app/components/tag';
import Truncate from 'app/components/truncate';
import space from 'app/styles/space';
import theme, {aliases} from 'app/utils/theme';

type MetaDataProps = {
  headingText: string;
  tooltipText: string;
  bodyText: React.ReactNode;
  subtext: React.ReactNode;
};

export function MetaData({headingText, tooltipText, bodyText, subtext}: MetaDataProps) {
  return (
    <HeaderInfo>
      <StyledSectionHeading>
        {headingText}
        <QuestionTooltip
          position="top"
          size="sm"
          containerDisplayMode="block"
          title={tooltipText}
        />
      </StyledSectionHeading>
      <SectionBody>{bodyText}</SectionBody>
      <SectionSubtext>{subtext}</SectionSubtext>
    </HeaderInfo>
  );
}

const HeaderInfo = styled('div')`
  height: 78px;
`;

const StyledSectionHeading = styled(SectionHeading)`
  margin: 0;
`;

const SectionBody = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  margin: ${space(0.5)} 0;
`;

export const SectionSubtext = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export const IssueSubtext = styled(SectionSubtext)`
  color: ${p => p.theme.error};
`;

const nodeColors = {
  error: {
    color: theme.white,
    background: theme.red300,
    border: theme.red300,
  },
  warning: {
    color: theme.red300,
    background: theme.white,
    border: theme.red300,
  },
  white: {
    color: theme.gray500,
    background: theme.white,
    border: theme.gray500,
  },
  black: {
    color: theme.white,
    background: theme.gray500,
    border: aliases.border,
  },
};

export const EventNode = styled(Tag)<{pad?: 'left' | 'right'}>`
  div {
    color: ${p => nodeColors[p.type || 'white'].color};
  }
  & ${/* sc-selector */ Background} {
    background-color: ${p => nodeColors[p.type || 'white'].background};
    border: 1px solid ${p => nodeColors[p.type || 'white'].border};
  }
`;

export const TraceConnector = styled('div')`
  width: ${space(1)};
  border-top: 1px solid ${p => p.theme.border};
`;

export const QuickTraceContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledMenuItem = styled(MenuItem)<{first?: boolean}>`
  border-top: ${p => (!p.first ? `1px solid ${p.theme.innerBorder}` : null)};
  width: 350px;
`;

const MenuItemContent = styled('div')`
  display: flex;
  justify-content: space-between;
  width: 100%;
`;

type DropdownItemProps = {
  children: React.ReactNode;
  to?: string | LocationDescriptor;
  onSelect?: (eventKey: any) => void;
  first?: boolean;
};

export function DropdownItem({children, first, onSelect, to}: DropdownItemProps) {
  return (
    <StyledMenuItem to={to} onSelect={onSelect} first={first}>
      <MenuItemContent>{children}</MenuItemContent>
    </StyledMenuItem>
  );
}

export const DropdownItemSubContainer = styled('div')`
  display: flex;
  flex-direction: row;
`;

export const StyledTruncate = styled(Truncate)`
  margin-left: ${space(1)};
`;
