import CommonTheme from './theme';

/**
 * Do not import theme values directly as they only define light color theme.
 * Consuming it directly means that you won't get the correct colors in dark mode.
 * @deprecated use useTheme hook instead.
 */
export default CommonTheme;
// Previous import was from app/utils/theme.tsx
// biome-ignore lint/performance/noBarrelFile: Remove this once imports are fixed
export * from './theme';
