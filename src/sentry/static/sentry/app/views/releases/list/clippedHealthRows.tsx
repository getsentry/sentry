import * as React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import space from 'app/styles/space';
import {t, tct} from 'app/locale';
import Button from 'app/components/button';

const defaultprops = {
  maxVisibleItems: 4,
  fadeHeight: 46,
};
const WRAPPER_DEFAULT_HEIGHT = defaultprops.fadeHeight * defaultprops.maxVisibleItems;

type Props = {
  children: React.ReactNode[];
  className?: string;
} & typeof defaultprops;

type State = {
  isCollapsed: boolean;
};

// TODO(matej): refactor to reusable component

class clippedHealthRows extends React.Component<Props, State> {
  static defaultProps = defaultprops;
  state: State = {
    isCollapsed: true,
  };
  reveal = () => {
    this.setState({isCollapsed: false});
  };
  collapse = () => {
    this.setState({isCollapsed: true});
  };
  renderShowMoreButton() {
    const {children, maxVisibleItems} = this.props;

    const showMoreBtnProps: React.ComponentProps<typeof Button> & {
      'data-test-id': string;
    } = {
      onClick: this.reveal,
      priority: 'primary',
      size: 'xsmall',
      'data-test-id': 'show-more',
    };

    return (
      <ShowMoreWrapper key="show-more">
        <SmallerDevicesShowMoreButton {...showMoreBtnProps}>
          {tct('Show [numberOfFrames] More', {
            numberOfFrames: children.length - defaultprops.maxVisibleItems,
          })}
        </SmallerDevicesShowMoreButton>
        <LargerDevicesShowMoreButton {...showMoreBtnProps}>
          {tct('Show [numberOfFrames] More', {
            numberOfFrames: children.length - maxVisibleItems,
          })}
        </LargerDevicesShowMoreButton>
      </ShowMoreWrapper>
    );
  }

  render() {
    const {children, maxVisibleItems, fadeHeight, className} = this.props;
    const {isCollapsed} = this.state;

    const displayCollapsedButton = !isCollapsed && children.length > maxVisibleItems;

    return (
      <Wrapper
        className={className}
        fadeHeight={fadeHeight}
        displayCollapsedButton={displayCollapsedButton}
        height={
          isCollapsed && children.length > maxVisibleItems
            ? WRAPPER_DEFAULT_HEIGHT
            : undefined
        }
      >
        {children.map((item, index) => {
          if (!isCollapsed || index < maxVisibleItems) {
            return item;
          }

          if (index === maxVisibleItems) {
            return this.renderShowMoreButton();
          }
          return null;
        })}

        {displayCollapsedButton && (
          <CollapseWrapper>
            <Button
              onClick={this.collapse}
              priority="primary"
              size="xsmall"
              data-test-id="collapse"
            >
              {t('Collapse')}
            </Button>
          </CollapseWrapper>
        )}
      </Wrapper>
    );
  }
}

const absoluteButtonStyle = css`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ShowMoreWrapper = styled('div')`
  ${absoluteButtonStyle};
  background-image: linear-gradient(
    180deg,
    hsla(0, 0%, 100%, 0.15) 0,
    ${p => p.theme.white}
  );
  background-repeat: repeat-x;
  border-bottom: ${space(1)} solid ${p => p.theme.white};
  border-top: ${space(1)} solid transparent;
`;

const CollapseWrapper = styled('div')`
  ${absoluteButtonStyle};
`;

const Wrapper = styled('div')<{
  fadeHeight: number;
  displayCollapsedButton: boolean;
  height?: number;
}>`
  position: relative;
  ${ShowMoreWrapper} {
    height: ${p => p.fadeHeight}px;
  }
  ${CollapseWrapper} {
    height: ${p => p.fadeHeight}px;
  }
  ${p => p.displayCollapsedButton && `padding-bottom: ${p.fadeHeight}px;`}

  ${p =>
    p.height &&
    `
      height: ${p.height}px;
      @media (min-width: ${p.theme.breakpoints[0]}) {
        height: auto;
      }
  `}
`;

const SmallerDevicesShowMoreButton = styled(Button)`
  display: block;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const LargerDevicesShowMoreButton = styled(Button)`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
  }
`;

export default clippedHealthRows;
