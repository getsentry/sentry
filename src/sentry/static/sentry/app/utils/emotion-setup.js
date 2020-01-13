/* global process */

// NEEDS to be true for production because of performance
// But travis builds with NODE_ENV = production, so turn off speed when
// IS_PERCY is true (i.e. we are in TRAVIS and PERCY_TOKEN is set)
if (process.env.IS_PERCY) {
  const sheet = require('emotion').sheet; // eslint-disable-line emotion/no-vanilla
  sheet.speedy(false);
}
