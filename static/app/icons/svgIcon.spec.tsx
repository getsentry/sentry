import type {ComponentType} from 'react';
import {expectTypeOf} from 'expect-type';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {IconGraphProps} from 'sentry/icons';

import {SvgIcon, type SVGIconProps} from './svgIcon';
import {IconDefaultsProvider} from './useIconDefaults';

describe('SVGIconProps', () => {
  it('allows icons with a narrower type prop to be assigned to ComponentType<SVGIconProps>', () => {
    // IconGraph extends SVGIconProps with type?: 'line' | 'circle' | 'bar' | 'area' | 'scatter'.
    // Before the fix, SVGIconProps inherited `type?: string` from React.SVGAttributes,
    // which made IconGraph incompatible with ComponentType<SVGIconProps> due to the
    // narrower union on `type`.
    expectTypeOf<ComponentType<IconGraphProps>>().toExtend<ComponentType<SVGIconProps>>();
  });

  it.each([
    [{}, '21px'],
    [{size: 'xs'}, '12px'],
    [{size: 'xs', legacySize: '10px'}, '10px'],
  ] satisfies Array<[SVGIconProps, string]>)(
    'allows explicit icon sizes to override inherited legacy size with %j',
    (props, size) => {
      render(
        <IconDefaultsProvider legacySize="21px">
          <SvgIcon {...props} aria-label="Icon" />
        </IconDefaultsProvider>
      );

      const icon = screen.getByRole('img', {name: 'Icon'});
      expect(icon).toHaveAttribute('width', size);
      expect(icon).toHaveAttribute('height', size);
    }
  );
});
