import * as React from 'react';
import styled from '@emotion/styled';
import PlatformIcon from 'platformicons';

import {PlatformKey} from 'app/data/platformCategories';

type Props = {
  platforms?: PlatformKey[];
  direction?: 'right' | 'left';
  /**
   * Maximum number of platform icons to display
   */
  max?: number;
  /**
   * Platform icon size in pixels
   */
  size?: number;
  /**
   * Will set container width to be size of having `this.props.max` icons
   * This is good for lists where the project name is displayed
   */
  consistentWidth?: boolean;
  className?: string;
};

const PlatformList = ({
  platforms = [],
  direction = 'right',
  max = 3,
  size = 16,
  consistentWidth = false,
  className,
}: Props) => {
  const getIcon = (platform: PlatformKey, index: number) => (
    <StyledPlatformIcon key={platform + index} platform={platform} size={size} />
  );

  const getIcons = (items: PlatformKey[]) => items.slice().reverse().map(getIcon);

  const platformsPreview = platforms.slice(0, max);
  return (
    <PlatformIcons
      direction={direction}
      max={max}
      size={size}
      consistentWidth={consistentWidth}
      className={className}
    >
      {platforms.length > 0 ? (
        getIcons(platformsPreview)
      ) : (
        <StyledPlatformIcon size={size} platform="default" />
      )}
    </PlatformIcons>
  );
};

const getOverlapWidth = (size: number) => Math.round(size / 4);

type IconsProps = Required<Pick<Props, 'direction' | 'consistentWidth' | 'max' | 'size'>>;

const PlatformIcons = styled('div')<IconsProps>`
  display: flex;
  flex-shrink: 0;
  flex-direction: row;
  justify-content: ${p => (p.direction === 'right' ? 'flex-end' : 'flex-start')};
  ${p =>
    p.consistentWidth && `width: ${p.size + (p.max - 1) * getOverlapWidth(p.size)}px;`};
`;

type IconProps = Omit<React.ComponentProps<typeof PlatformIcon>, 'size'> & {size: number};

const StyledPlatformIcon = styled(({size, ...props}: IconProps) => (
  <PlatformIcon size={`${size}px`} {...props} />
))`
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 0 0 1px ${p => p.theme.white};
  &:not(:first-child) {
    margin-left: ${p => `${p.size * -1 + getOverlapWidth(p.size)}px;`};
  }
`;

export default PlatformList;
