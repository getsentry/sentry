define([
  'angular',
  'ngBootstrap',
  'ngClassy',

  'moment',
  'jquery',

  'app/modules/charts',
  'app/modules/collection',
  'app/modules/forms'

], function(angular){
  'use strict';

  return angular.module('app', [
    'classy',
    'sentry.charts',
    'sentry.collection',
    'sentry.forms',
    'ui.bootstrap'
  ]);
});
