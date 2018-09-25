import React from 'react';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';
import {keyframes} from 'emotion';

import space from 'app/styles/space';

import {Panel, PanelItem} from 'app/components/panels';
import NavTabs from 'app/components/navTabs';
import Link from 'app/components/link';

const FOOTER_HEIGHT = 87;
const HEADER_HEIGHT = 60;
const TABS_HEIGHT = 55;

export const Discover = styled(Flex)`
  min-height: calc(100vh - ${FOOTER_HEIGHT}px);

  margin-bottom: -20px;

  .control-group {
    margin-bottom: 0; /* Do not want the global control-group margins  */
  }
`;

export const PageTitle = styled.h2`
  display: flex;
  font-size: 20px;
  font-weight: normal;
  color: ${p => p.theme.gray4};
  margin: 0;
  align-items: center;
  padding-left: 30px;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  height: ${HEADER_HEIGHT}px;
`;

export const Sidebar = styled(Flex)`
  flex-direction: column;
  border-right: 1px solid ${p => p.theme.borderDark};
  width: 320px;
`;

export const Body = styled(Flex)``;

export const BodyContent = styled(Flex)`
  flex: 1;
  flex-direction: column;
  padding: ${space(1.5)} 32px 32px 32px;
`;

export const TopBar = styled(Flex)`
  padding: 0 ${space(4)};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  height: ${HEADER_HEIGHT}px;
`;

export const SidebarTabs = styled(props => <NavTabs {...props} underlined={true} />)`
  padding: 20px 30px 0;
  margin: 0;
`;

export const PlaceholderText = styled.div`
  color: ${p => p.theme.gray6};
  font-size: 15px;
`;

export const Heading = styled.h2`
  font-size: 20px;
  font-weight: normal;
  color: ${p => p.theme.gray4};
  margin: 0;
`;

export const Fieldset = styled.fieldset`
  margin: ${space(3)} ${space(4)};
`;

export const SelectListItem = styled(Flex)`
  margin-top: ${space(0.5)};
`;

export const SidebarLabel = styled.label`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray3};
`;

export const AddText = styled.span`
  font-style: italic;
  text-decoration: underline;
  margin-left: 4px;
  font-size: 13px;
  line-height: 16px;
  color: ${p => p.theme.gray1};
`;

const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

export const ButtonSpinner = styled.div`
  animation: ${spin} 0.4s linear infinite;
  width: 14px;
  height: 14px;
  border-radius: 14px;
  border-top: 2px solid ${p => p.theme.borderLight};
  border-right: 2px solid ${p => p.theme.borderLight};
  border-bottom: 2px solid ${p => p.theme.borderLight};
  border-left: 2px solid ${p => p.theme.purple};
  margin-left: 4px;
`;

export const ResultSummary = styled(Box)`
  color: ${p => p.theme.gray6};
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: ${space(3)};
`;

export const ChartWrapper = styled(Panel)`
  padding: ${space(3)} ${space(2)};
`;

export const ChartNote = styled(Box)`
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray3};
  margin-bottom: ${space(3)};
`;

export const SavedQuery = styled(Box)`
  height: calc(100vh - ${FOOTER_HEIGHT + HEADER_HEIGHT + TABS_HEIGHT}px);
  overflow: scroll;
`;

export const SavedQueryList = styled(Panel)`
  margin: 0;
  border: 0;
`;

export const SavedQueryListItem = styled(PanelItem)`
  flex-direction: column;
  padding: ${space(2)} ${space(4)};
`;

export const SavedQueryLink = styled(Link)`
  font-weight: 600;
`;

export const SavedQueryUpdated = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray6};
`;
