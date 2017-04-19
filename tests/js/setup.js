jest.mock('app/translations');

import jQuery from 'jquery';
window.$ = window.jQuery = jQuery;

import sinon from 'sinon';
window.sinon = sinon;
