/**
 * Applied to every icon in src/ when generating the sprite. Icons are
 * expected to be raw Figma exports; fills are left untouched so that
 * single-color icons inherit `currentColor` from the <svg> and multicolor
 * icons (e.g. brand logos) keep their explicit fills.
 */
const config = {
  multipass: true,
  // svgo v4's preset-default keeps viewBox, which the sprite symbols require
  plugins: ['preset-default'],
};

// eslint-disable-next-line @sentry/no-default-exports -- svgo loadConfig requires it
export default config;
