import type {SVGAttributes} from 'react';

import type {IconName} from './names.generated';
import {ICON_VIEWBOXES} from './names.generated';
import {spriteUrl} from './spriteUrl';

export type IconDirection = 'up' | 'right' | 'down' | 'left';

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'name'> {
  name: IconName;
  /**
   * Rotates the icon. 'up' is the orientation the icon is drawn in.
   */
  direction?: IconDirection;
  /**
   * Rendered width and height. Numbers are pixels.
   */
  size?: number | string;
}

const ROTATION: Record<IconDirection, number> = {up: 0, right: 90, down: 180, left: 270};

export function Icon({name, direction, size = 16, style, ...props}: IconProps) {
  const rotated =
    direction && direction !== 'up'
      ? {transform: `rotate(${ROTATION[direction]}deg)`, ...style}
      : style;

  return (
    <svg
      // Icons contain a single graphic, so the img role applies
      role="img"
      data-test-id={`icon-${name}`}
      fill="currentColor"
      {...props}
      viewBox={ICON_VIEWBOXES[name]}
      width={size}
      height={size}
      style={rotated}
    >
      <use href={`${spriteUrl}#${name}`} />
    </svg>
  );
}
