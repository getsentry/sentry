import type {ComponentType} from 'react';
import {expectTypeOf} from 'expect-type';

import type {IconGraphProps} from 'sentry/icons';

import type {SVGIconProps} from './svgIcon';

describe('SVGIconProps', () => {
  it('allows icons with a narrower type prop to be assigned to ComponentType<SVGIconProps>', () => {
    // IconGraph extends SVGIconProps with type?: 'line' | 'circle' | 'bar' | 'area' | 'scatter'.
    // Before the fix, SVGIconProps inherited `type?: string` from React.SVGAttributes,
    // which made IconGraph incompatible with ComponentType<SVGIconProps> due to the
    // narrower union on `type`.
    expectTypeOf<ComponentType<IconGraphProps>>().toExtend<ComponentType<SVGIconProps>>();
  });
});
