/* global process */
import {sheet} from 'emotion';

// NEEDS to be true for production because of performance
// But travis builds with NODE_ENV = production, so turn off speed when
// IS_PERCY is true (i.e. we are in TRAVIS and PERCY_TOKEN is set)

let isSpeedy = process.env.IS_PERCY ? false : process.env.NODE_ENV !== 'development';
sheet.speedy(isSpeedy);
