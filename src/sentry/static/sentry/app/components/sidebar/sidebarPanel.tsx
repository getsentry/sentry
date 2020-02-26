import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import theme from 'app/utils/theme';
import space from 'app/styles/space';
import {IconClose} from 'app/icons';

type Props = React.HTMLProps<HTMLDivElement> & {
  title?: string;
  collapsed?: boolean;
  orientation?: 'top' | 'left';
  hidePanel?: () => void;
};

const SidebarPanel = ({
  orientation,
  collapsed,
  hidePanel,
  title,
  children,
  ...props
}: Props) => (
  <StyledSidebarPanel collapsed={collapsed} orientation={orientation} {...props}>
    <SidebarPanelHeader>
      <Title>{title}</Title>
      <PanelClose onClick={hidePanel} />
    </SidebarPanelHeader>

    <SidebarPanelBody>{children}</SidebarPanelBody>
  </StyledSidebarPanel>
);

SidebarPanel.propTypes = {
  title: PropTypes.string,
  collapsed: PropTypes.bool,
  orientation: PropTypes.oneOf(['top', 'left']),
  hidePanel: PropTypes.func,
};

export default SidebarPanel;

const getPositionForOrientation = (p: Props & {theme: typeof theme}) =>
  p.orientation === 'top'
    ? css`
        top: ${p.theme.sidebar.mobileHeight};
        left: 0;
        right: 0;
      `
    : css`
        width: ${p.theme.sidebar.panel.width};
        top: 0;
        left: ${p.collapsed
          ? p.theme.sidebar.collapsedWidth
          : p.theme.sidebar.expandedWidth};
      `;

const StyledSidebarPanel = styled('div')`
  position: fixed;
  bottom: 0;
  background: ${p => p.theme.whiteDark};
  z-index: ${p => p.theme.zIndex.sidebar};
  color: ${p => p.theme.sidebar.background};
  border-right: 1px solid ${p => p.theme.borderLight};
  box-shadow: 1px 0 2px rgba(0, 0, 0, 0.06);
  text-align: left;
  line-height: 24px;

  ${getPositionForOrientation};
`;

const SidebarPanelHeader = styled('div')`
  border-bottom: 1px solid ${p => p.theme.borderLight};
  padding: ${space(3)};
  background: ${p => p.theme.background};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  height: ${p => p.theme.sidebar.panel.headerHeight};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
const SidebarPanelBody = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: ${p => p.theme.sidebar.panel.headerHeight};
  overflow: auto;
`;

const PanelClose = styled(IconClose)`
  color: ${p => p.theme.gray3};
  cursor: pointer;
  position: relative;
  padding: ${space(0.75)};

  &:hover {
    color: ${p => p.theme.gray5};
  }
`;

PanelClose.defaultProps = {
  size: 'lg',
};

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: 0;
`;
