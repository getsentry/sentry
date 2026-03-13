import {ThemeProvider} from '@emotion/react';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {
  AlignmentDemo,
  alignments,
  densityConfigs,
  DensityDemo,
  ElementDemo,
  elements,
  EllipsisDemo,
  FractionComparisonDemo,
  MonospaceComparisonDemo,
  ResponsiveDemo,
  SizeDemo,
  sizes,
  TabularComparisonDemo,
  typographyFeatures,
  VariantDemo,
  variants,
  WordBreakDemo,
  WrapBalanceDemo,
} from './text.demos';

const themes = {light: lightTheme, dark: darkTheme};

describe('Text', () => {
  describe.each(['light', 'dark'] as const)('theme-%s', themeName => {
    it.snapshot.each(sizes)('size-%s', size => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <SizeDemo size={size} />
        </div>
      </ThemeProvider>
    ));

    it.snapshot.each([...variants])('variant-%s', variant => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <VariantDemo variant={variant} />
        </div>
      </ThemeProvider>
    ));

    it.snapshot.each([...elements])('element-%s', as => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <ElementDemo as={as} />
        </div>
      </ThemeProvider>
    ));

    it.snapshot.each(typographyFeatures.map(f => f.name))('typography-%s', name => {
      const feature = typographyFeatures.find(f => f.name === name)!;
      return (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>{feature.render()}</div>
        </ThemeProvider>
      );
    });

    it.snapshot.each([...alignments])('alignment-%s', align => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <AlignmentDemo align={align} />
        </div>
      </ThemeProvider>
    ));

    it.snapshot.each(densityConfigs.map(d => d.name))('density-%s', name => {
      const config = densityConfigs.find(d => d.name === name)!;
      return (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{padding: 8}}>
            <DensityDemo density={config.density} label={config.label} />
          </div>
        </ThemeProvider>
      );
    });

    it.snapshot('ellipsis', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <EllipsisDemo />
        </div>
      </ThemeProvider>
    ));

    it.snapshot('wrapping-word-break', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <WordBreakDemo />
        </div>
      </ThemeProvider>
    ));

    it.snapshot('wrapping-balance', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <WrapBalanceDemo />
        </div>
      </ThemeProvider>
    ));

    it.snapshot('monospace', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <MonospaceComparisonDemo />
        </div>
      </ThemeProvider>
    ));

    it.snapshot('font-feature-tabular', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <TabularComparisonDemo />
        </div>
      </ThemeProvider>
    ));

    it.snapshot('font-feature-fraction', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <FractionComparisonDemo />
        </div>
      </ThemeProvider>
    ));

    it.snapshot('responsive', () => (
      <ThemeProvider theme={themes[themeName]}>
        <div style={{padding: 8}}>
          <ResponsiveDemo />
        </div>
      </ThemeProvider>
    ));
  });
});
