import {Flex, Box} from 'grid-emotion';
import {keyframes} from 'emotion';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelItem} from 'app/components/panels';
import {slideInLeft} from 'app/styles/animations';
import Button from 'app/components/button';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import Link from 'app/components/link';
import NavTabs from 'app/components/navTabs';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import InlineSvg from 'app/components/inlineSvg';
import ExternalLink from 'app/components/externalLink';

const HEADER_HEIGHT = 60;

export const DiscoverWrapper = styled(Flex)`
  flex: 1;
`;

export const DiscoverContainer = styled(Flex)`
  width: 100%;
  height: 100vh;
  position: relative;

  margin-bottom: -20px;

  .control-group {
    margin-bottom: 0; /* Do not want the global control-group margins  */
  }
`;

export const DiscoverGlobalSelectionHeader = styled(GlobalSelectionHeader)`
  position: absolute;
  top: 0;
  left: 0;
`;

export const PageTitle = styled.h2`
  display: flex;
  font-size: 20px;
  font-weight: normal;
  color: ${p => p.theme.gray4};
  margin: 0;
  align-items: center;
  padding-left: ${space(4)};
  height: ${HEADER_HEIGHT}px;
`;

export const ResultViewActions = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  margin-bottom: ${space(3)};

  @media (max-width: ${theme.breakpoints[1]}) {
    justify-content: flex-start;
  }
`;

export const ResultViewButtons = styled(NavTabs)`
  margin-bottom: 0;

  @media (max-width: ${theme.breakpoints[1]}) {
    display: none;
  }
`;

export const ResultViewDropdownButtons = styled('div')`
  display: none;
  @media (max-width: ${theme.breakpoints[1]}) {
    display: flex;
    margin-bottom: ${space(2)};
  }
`;

export const DownloadCsvButton = styled(Button)`
  @media (max-width: ${theme.breakpoints[1]}) {
    margin-left: ${space(0.5)};
    top: 0;
  }
`;

export const Sidebar = styled(props => (
  <Flex {...props} direction="column" w={[300, 300, 300, 360]} />
))`
  border-right: 1px solid ${p => p.theme.borderDark};
  background: #fff;
  min-width: 320px;
  position: relative;
  padding-top: ${HEADER_HEIGHT}px;
`;

export const QueryFieldsSidebar = styled(Flex)`
  height: 100%;
  flex-direction: column;
  justify-content: flex-start;
`;

export const DocsSeparator = styled('div')`
  flex-grow: 1;
  margin: ${space(3)} ${space(3)} 0;
  border-bottom: 1px solid ${p => p.theme.borderLight};
`;

export const DocsLink = styled(ExternalLink)`
  color: ${p => p.theme.gray4};
  &:hover {
    color: ${p => p.theme.blue};
  }
`;

export const StyledInlineSvg = styled(InlineSvg)`
  justify-content: flex-end;
`;

export const DiscoverDocs = styled('span')`
  align-items: center;
  display: flex;
  margin: 25px ${space(3)};
  justify-content: space-between;
`;

export const DocsLabel = styled('span')`
  font-size: 15px;
  flex-grow: 1;
`;

export const DocsIcon = styled(InlineSvg)`
  width: 20px;
  height: 20px;
  margin-right: 8px;
`;

export const Body = styled(Flex)`
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  padding-top: ${HEADER_HEIGHT}px;
`;

export const BodyContent = styled(Flex)`
  flex: 1;
  flex-direction: column;
  padding: ${space(3)} ${space(4)} ${space(4)} ${space(4)};
  overflow-y: scroll;
  position: relative;
  background: ${p => p.theme.whiteDark};
`;

export const LoadingContainer = styled(Flex)`
  flex: 1;
  align-items: center;
  height: 100%;
`;

export const SidebarTabs = styled(props => <NavTabs {...props} underlined={true} />)`
  padding: ${space(3)} ${space(3)} 0;
  margin: 0;
`;

export const PlaceholderText = styled.div`
  color: ${p => p.theme.gray6};
  font-size: 15px;
`;

export const HeadingContainer = styled(Flex)`
  min-width: 70px;
  margin: ${space(1)} 0 ${space(2)};
  align-items: center;
`;

export const Fieldset = styled.fieldset`
  margin: ${space(3)} ${space(3)} 0;
`;

export const SelectListItem = styled(Flex)`
  margin-top: ${space(0.5)};
`;

export const SidebarLabel = styled.label`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray3};
`;

export const QueryFieldsContainer = styled('div')`
  flex: 1;
  overflow-y: scroll;
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
`;

export const ResultSummaryAndButtons = styled(Flex)`
  justify-content: space-between;
`;

export const ResultContainer = styled('div')`
  display: flex;
  flex: 1;
  flex-direction: column;
  margin-bottom: ${space(3)};
`;

export const ResultInnerContainer = styled('div')`
  flex: 1;
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

export const SavedQueryAction = styled(Link)`
  color: ${p => p.theme.gray6};
  margin-left: ${space(2)};
  display: flex;
`;

export const SavedQueryWrapper = styled('div')`
  flex: 1;
  overflow-y: scroll;
`;

export const SavedQueryList = styled(Panel)`
  margin: 0;
  border: 0;
  overflow: hidden;
`;

export const SavedQueryListItem = styled(({isActive, ...props}) => (
  <PanelItem {...props} />
))`
  flex-direction: column;
  padding: 0;
  background-color: ${p => (p.isActive ? p.theme.whiteDark : p.theme.white)};
`;

export const SavedQueryLink = styled(Link)`
  font-weight: 600;
  padding: ${space(2)} ${space(4)};
`;

export const SavedQueryUpdated = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray6};
`;

export const QueryPanelContainer = styled('div')`
  position: absolute;
  width: calc(100% + 1px); /* Add 1px for border */
  height: calc(100% - ${HEADER_HEIGHT}px);
  background-color: white;
  top: ${HEADER_HEIGHT}px;
  border-right: 1px solid ${p => p.theme.borderLight};
  animation: ${slideInLeft} 0.2s ease-in;
  overflow-y: scroll;
`;

export const QueryPanelTitle = styled(Flex)`
  justify-content: space-between;
  align-items: center;
  padding: 0 ${space(4)};
  height: ${HEADER_HEIGHT}px;
  border-bottom: 1px solid ${p => p.theme.borderLight};
`;

export const QueryPanelCloseLink = styled(Link)`
  color: ${p => p.theme.gray6};
`;
