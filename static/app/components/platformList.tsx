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
  switch (platforms.length) {
    case 0:
      return <StyledPlatformIcon size={size} platform="default" />;

    case 1:
      return (
        <StyledPlatformIcon
          data-test-id={`platform-icon-${platforms[0]}`}
          platform={platforms[0]!}
          size={size}
        />
      );

    default: {
      const platformIcons = platforms.slice(0, max).reverse();

      return (
        <Wrapper ref={ref} className={className} size={size}>
          <PlatformIcons>
            {platformIcons.map((platform, index) => (
              <StyledPlatformIcon
                data-test-id={`platform-icon-${platform}`}
                key={platform + index}
                platform={platform}
                size={size}
              />
            ))}
          </PlatformIcons>
        </Wrapper>
      );
    }
  }
}

function getOverlapWidth(size: number) {
  return Math.round(size / 4);
}

const PlatformIcons = styled('div')`
  display: flex;
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  cursor: default;
  border-radius: ${p => p.theme.radius.md};
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
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
