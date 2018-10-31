import React from 'react';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';
import {keyframes} from 'emotion';

import space from 'app/styles/space';

import {Panel, PanelItem} from 'app/components/panels';
import NavTabs from 'app/components/navTabs';
import Link from 'app/components/link';

const HEADER_HEIGHT = 60;

export const DiscoverWrapper = styled(Flex)`
  flex: 1;
`;

export const DiscoverContainer = styled(Flex)`
  width: 100%;
  height: 100vh;

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
  padding-left: ${space(4)};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  height: ${HEADER_HEIGHT}px;
`;

export const Sidebar = styled(props => (
  <Flex {...props} direction="column" w={[320, 320, 320, 380]} />
))`
  border-right: 1px solid ${p => p.theme.borderDark};
  min-width: 320px;
  position: relative;
`;

export const Body = styled(Flex)`
  flex: 1;
  flex-direction: column;
`;

export const BodyContent = styled(Flex)`
  flex: 1;
  flex-direction: column;
  padding: ${space(1.5)} 32px 32px 32px;
  overflow-y: scroll;
  position: relative;
`;

export const LoadingContainer = styled(Flex)`
  flex: 1;
  align-items: center;
  height: 100%;
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

export const SavedQueryTitle = styled(Flex)`
  justify-content: space-between;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1.5)} ${space(4)};
  color: ${p => p.theme.gray4};
  font-weight: 600;
  border-bottom: 1px solid ${p => p.theme.borderLight};
`;

export const PlaceholderText = styled.div`
  color: ${p => p.theme.gray6};
  font-size: 15px;
`;

export const Heading = styled.h2`
  font-size: 20px;
  line-height: 24px;
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
`;

export const SavedQueryWrapper = styled('div')`
  flex: 1;
  overflow-y: scroll;
`;

export const SavedQueryList = styled(Panel)`
  margin: 0;
  border: 0;
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

const slidein = keyframes`
  0% {
    left: -100%;
  }
  100% {
    left: 0;
  }
`;

export const QueryPanelContainer = styled('div')`
  position: absolute;
  width: calc(100% + 1px); /* Add 1px for border */
  height: calc(100% - ${HEADER_HEIGHT}px);
  background-color: white;
  top: ${HEADER_HEIGHT}px;
  border-right: 1px solid ${p => p.theme.borderLight};
  animation: ${slidein} 0.6s ease-in;
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
