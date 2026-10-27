import type {ComponentType} from 'react';
import {createRef} from 'react';
import {ThemeProvider} from '@emotion/react';
import type {IconGraphProps} from '@sentry/icons/graph';
import {render, screen} from '@testing-library/react';
import {expectTypeOf} from 'expect-type';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';
import {IconDefaultsProvider} from './useIconDefaults';

const theme = {
  tokens: {
    content: {
      accent: '#111111',
      danger: '#222222',
      promotion: '#333333',
      success: '#444444',
      warning: '#555555',
      primary: '#666666',
      secondary: '#777777',
    },
    graphics: {warning: {vibrant: '#888888'}},
  },
};

describe('SvgIcon', () => {
  it('renders without a theme when no variant is set', () => {
    const ref = createRef<SVGSVGElement>();
    render(<SvgIcon ref={ref} aria-label="Add" />);

    const icon = screen.getByRole('img', {name: 'Add'});
    expect(icon).toHaveAttribute('fill', 'currentColor');
    expect(icon).toHaveAttribute('viewBox', '0 0 16 16');
    expect(icon).toHaveAttribute('height', '16px');
    expect(icon).toHaveAttribute('width', '16px');
    expect(ref.current).toBe(icon);
  });

  it.each([
    ['xs', '12px'],
    ['sm', '14px'],
    ['md', '16px'],
    ['lg', '24px'],
    ['xl', '32px'],
    ['2xl', '72px'],
  ] as const)('renders size %s at %s', (size, pixels) => {
    render(<SvgIcon size={size} />);
    expect(screen.getByRole('img')).toHaveAttribute('width', pixels);
    expect(screen.getByRole('img')).toHaveAttribute('height', pixels);
    expect(screen.getByRole('img')).not.toHaveAttribute('size');
  });

  it('uses legacySize before size', () => {
    render(<SvgIcon legacySize="20px" size="xl" />);
    expect(screen.getByRole('img')).toHaveAttribute('width', '20px');
    expect(screen.getByRole('img')).not.toHaveAttribute('legacySize');
  });

  it.each([
    ['accent', '#111111'],
    ['danger', '#222222'],
    ['promotion', '#333333'],
    ['success', '#444444'],
    ['warning', '#888888'],
    ['primary', '#666666'],
    ['secondary', '#777777'],
    ['muted', '#777777'],
  ] as const)('renders variant %s with its theme color', (variant, color) => {
    render(
      <ThemeProvider theme={theme}>
        <SvgIcon variant={variant} />
      </ThemeProvider>
    );
    expect(screen.getByRole('img')).toHaveAttribute('fill', color);
    expect(screen.getByRole('img')).not.toHaveAttribute('variant');
  });

  it('applies shared defaults and lets explicit props override them', () => {
    render(
      <ThemeProvider theme={theme}>
        <IconDefaultsProvider size="lg" variant="danger">
          <SvgIcon aria-label="Default" />
          <SvgIcon aria-label="Override" size="sm" variant="success" />
          <SvgIcon aria-label="Clear" size={undefined} variant={undefined} />
        </IconDefaultsProvider>
      </ThemeProvider>
    );

    expect(screen.getByRole('img', {name: 'Default'})).toHaveAttribute('width', '24px');
    expect(screen.getByRole('img', {name: 'Default'})).toHaveAttribute('fill', '#222222');
    expect(screen.getByRole('img', {name: 'Override'})).toHaveAttribute('width', '14px');
    expect(screen.getByRole('img', {name: 'Override'})).toHaveAttribute(
      'fill',
      '#444444'
    );
    expect(screen.getByRole('img', {name: 'Clear'})).toHaveAttribute('width', '16px');
    expect(screen.getByRole('img', {name: 'Clear'})).toHaveAttribute(
      'fill',
      'currentColor'
    );
  });
});

describe('SVGIconProps', () => {
  it('allows icons with a narrower type prop to be assigned to ComponentType<SVGIconProps>', () => {
    // IconGraph extends SVGIconProps with type?: 'line' | 'circle' | 'bar' | 'area' | 'scatter'.
    // Before the fix, SVGIconProps inherited `type?: string` from React.SVGAttributes,
    // which made IconGraph incompatible with ComponentType<SVGIconProps> due to the
    // narrower union on `type`.
    expectTypeOf<ComponentType<IconGraphProps>>().toExtend<ComponentType<SVGIconProps>>();
  });
});
