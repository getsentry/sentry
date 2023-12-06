import {css, Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Tooltip} from 'sentry/components/tooltip';
import {tn} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types';
import getPlatformName from 'sentry/utils/getPlatformName';

type Props = {
  className?: string;
  /**
   * Will set container width to be size of having `this.props.max` icons
   * This is good for lists where the project name is displayed
   */
  consistentWidth?: boolean;
  direction?: 'right' | 'left';
  /**
   * Maximum number of platform icons to display
   */
  max?: number;
  platforms?: PlatformKey[];
  /**
   * If true and if the number of children is greater than the max prop,
   * a counter will be displayed at the end of the stack
   */
  showCounter?: boolean;
  /**
   * Platform icon size in pixels
   */
  size?: number;
};

type WrapperProps = Required<
  Pick<Props, 'showCounter' | 'size' | 'direction' | 'consistentWidth' | 'max'>
>;

function PlatformList({
  platforms = [],
  direction = 'right',
  max = 3,
  size = 16,
  consistentWidth = false,
  showCounter = false,
  className,
}: Props) {
  const visiblePlatforms = platforms.slice(0, max);
  const numNotVisiblePlatforms = platforms.length - visiblePlatforms.length;
  const displayCounter = showCounter && !!numNotVisiblePlatforms;

  function renderContent() {
    if (!platforms.length) {
      return <StyledPlatformIcon size={size} platform="default" />;
    }

    const platformIcons = visiblePlatforms.slice().reverse();

    if (displayCounter) {
      return (
        <InnerWrapper>
          <PlatformIcons>
            {platformIcons.map((visiblePlatform, index) => (
              <Tooltip
                key={visiblePlatform + index}
                title={getPlatformName(visiblePlatform)}
                containerDisplayMode="inline-flex"
              >
                <StyledPlatformIcon platform={visiblePlatform} size={size} />
              </Tooltip>
            ))}
          </PlatformIcons>
          <Tooltip
            title={tn('%s other platform', '%s other platforms', numNotVisiblePlatforms)}
            containerDisplayMode="inline-flex"
          >
            <Counter>
              {numNotVisiblePlatforms}
              <Plus>{'\u002B'}</Plus>
            </Counter>
          </Tooltip>
        </InnerWrapper>
      );
    }

    return (
      <PlatformIcons>
        {platformIcons.map((visiblePlatform, index) => (
          <StyledPlatformIcon
            data-test-id={`platform-icon-${visiblePlatform}`}
            key={visiblePlatform + index}
            platform={visiblePlatform}
            size={size}
          />
        ))}
      </PlatformIcons>
    );
  }

  return (
    <Wrapper
      consistentWidth={consistentWidth}
      className={className}
      size={size}
      showCounter={displayCounter}
      direction={direction}
      max={max}
    >
      {renderContent()}
    </Wrapper>
  );
}

export default PlatformList;

function getOverlapWidth(size: number) {
  return Math.round(size / 4);
}

const commonStyles = ({theme}: {theme: Theme}) => `
  cursor: default;
  border-radius: ${theme.borderRadius};
  box-shadow: 0 0 0 1px ${theme.background};
  :hover {
    z-index: 1;
  }
`;

const PlatformIcons = styled('div')`
  display: flex;
`;

const InnerWrapper = styled('div')`
  display: flex;
  position: relative;
`;

const Plus = styled('span')`
  font-size: 10px;
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  ${p => commonStyles(p)};
`;

const Counter = styled('div')`
  ${p => commonStyles(p)};
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  background-color: ${p => p.theme.gray200};
  color: ${p => p.theme.gray300};
  padding: 0 1px;
  position: absolute;
  right: -1px;
`;

const Wrapper = styled('div')<WrapperProps>`
  display: flex;
  flex-shrink: 0;
  justify-content: ${p => (p.direction === 'right' ? 'flex-end' : 'flex-start')};
  ${p =>
    p.consistentWidth && `width: ${p.size + (p.max - 1) * getOverlapWidth(p.size)}px;`};

  ${PlatformIcons} {
    ${p =>
      p.showCounter
        ? css`
            z-index: 1;
            flex-direction: row-reverse;
            > * :not(:first-child) {
              margin-right: ${p.size * -1 + getOverlapWidth(p.size)}px;
            }
          `
        : css`
            > * :not(:first-child) {
              margin-left: ${p.size * -1 + getOverlapWidth(p.size)}px;
            }
          `}
  }

  ${InnerWrapper} {
    padding-right: ${p => p.size / 2 + 1}px;
  }

  ${Counter} {
    height: ${p => p.size}px;
    min-width: ${p => p.size}px;
  }
`;
