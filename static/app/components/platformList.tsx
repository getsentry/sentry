import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Flex} from '@sentry/scraps/layout';

import type {PlatformKey} from 'sentry/types/project';

type Props = {
  className?: string;
  /**
   * Maximum number of platform icons to display
   */
  max?: number;
  platforms?: PlatformKey[];
  ref?: React.Ref<HTMLDivElement>;
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
}: Props) {
  const visiblePlatforms = platforms.slice(0, max);

  function renderContent() {
    if (!platforms.length) {
      return <StyledPlatformIcon size={size} platform="default" />;
    }

    const platformIcons = visiblePlatforms.slice().reverse();

    return (
      <Flex>
        {platformIcons.map((visiblePlatform, index) => (
          <StyledPlatformIcon
            data-test-id={`platform-icon-${visiblePlatform}`}
            key={visiblePlatform + index}
            platform={visiblePlatform}
            size={size}
          />
        ))}
      </Flex>
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

const StyledPlatformIcon = styled(PlatformIcon)`
  cursor: default;
  border-radius: ${p => p.theme.radius.md};
  box-shadow: 0 0 0 1px ${p => p.theme.tokens.background.primary};
  :hover {
    z-index: 1;
  }
  height: ${p => p.size}px;
  min-width: ${p => p.size}px;
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
`;
