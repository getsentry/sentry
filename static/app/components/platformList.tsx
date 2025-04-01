import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import type {PlatformKey} from 'sentry/types/project';

type Props = {
  className?: string;
  /**
   * Maximum number of platform icons to display
   */
  max?: number;
  platforms?: PlatformKey[];
  /**
   * Platform icon size in pixels
   */
  size?: number;
};

type WrapperProps = Required<Pick<Props, 'size'>>;

export function PlatformList({
  platforms = [],
  max = 3,
  size = 16,
  className,
  ref,
}: Props & {ref?: React.Ref<HTMLDivElement>}) {
  const visiblePlatforms = platforms.slice(0, max);

  function renderContent() {
    if (!platforms.length) {
      return <StyledPlatformIcon size={size} platform="default" />;
    }

    const platformIcons = visiblePlatforms.slice().reverse();

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
    <Wrapper ref={ref} className={className} size={size}>
      {renderContent()}
    </Wrapper>
  );
}

function getOverlapWidth(size: number) {
  return Math.round(size / 4);
}

const commonStyles = ({theme}: {theme: Theme}) => css`
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

const StyledPlatformIcon = styled(PlatformIcon)`
  ${p => commonStyles(p)};
`;

const Counter = styled('div')`
  ${p => commonStyles(p)};
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  background-color: ${p => p.theme.gray200};
  color: ${p => p.theme.subText};
  padding: 0 1px;
  position: absolute;
  right: -1px;
`;

const Wrapper = styled('div')<WrapperProps>`
  display: flex;
  flex-shrink: 0;
  justify-content: flex-end;

  ${PlatformIcons} {
    ${p => css`
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
