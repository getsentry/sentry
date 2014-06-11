var require = {
  paths: {
    'angular': 'vendor/angular/angular.min',
    'backbone': 'vendor/backbone/backbone',
    'bootstrap': 'vendor/bootstrap/dist/js/bootstrap.min',
    'bootstrap-datepicker': 'vendor/bootstrap-datepicker/js/bootstrap-datepicker',
    'd3': 'vendor/d3/d3.min',
    'd3-tip': 'vendor/d3-tip/index',
    'jquery': 'vendor/jquery/jquery.min',
    'jquery.clippy': 'scripts/lib/jquery.clippy.min',
    'jquery.cookie': 'scripts/lib/jquery.cookie',
    'jquery.flot': 'vendor/jquery-flot/jquery.flot',
    'jquery.flot.dashes': 'scripts/lib/jquery.flot.dashes',
    'jquery.flot.resize': 'vendor/jquery-flot/jquery.flot.resize',
    'jquery.flot.time': 'vendor/jquery-flot/jquery.flot.time',
    'jquery.flot.tooltip': 'scripts/lib/jquery.flot.tooltip',
    'json2': 'vendor/json2/json2',
    'moment': 'vendor/moment/min/moment.min',
    'ngBootstrap': 'vendor/angular-bootstrap/ui-bootstrap-tpls.min',
    'ngClassy': 'vendor/angular-classy/angular-classy.min',
    'ngHttpAuth': 'vendor/angular-http-auth/src/http-auth-interceptor',
    'ngLoadingBar': 'vendor/angular-loading-bar/build/loading-bar.min',
    'ngRaven': 'vendor/angular-raven/angular-raven',
    'ngRoute': 'vendor/angular-route/angular-route',
    'ngRouter': 'vendor/angular-ui-router/release/angular-ui-router',
    'ngSanitize': 'vendor/angular-sanitize/angular-sanitize',
    'selectize': 'vendor/selectize/dist/js/standalone/selectize.min',
    'simple-slider': 'vendor/simple-slider/simple-slider',
    'underscore': 'vendor/underscore/underscore',
    'text': 'vendor/requirejs-plugins/lib/text',
  },
  shim: {
    'backbone': {
      deps: ['json2', 'underscore']
    },
    'bootstrap': {
      deps: ['jquery']
    },
    'bootstrap-datepicker': {
      deps: ['bootstrap']
    },
    'jquery': {
      exports: ['jquery', '$']
    },
    'jquery.clippy': {
      deps: ['jquery']
    },
    'jquery.cookie': {
      deps: ['jquery']
    },
    'jquery.migrate': {
      deps: ['jquery']
    },
    'jquery.flot': {
      deps: ['jquery']
    },
    'jquery.flot.dashes': {
      deps: ['jquery.flot']
    },
    'jquery.flot.resize': {
      deps: ['jquery.flot']
    },
    'jquery.flot.time': {
      deps: ['jquery.flot']
    },
    'jquery.flot.tooltip': {
      deps: ['jquery.flot']
    },
    'angular': {
      exports: 'angular',
      deps: ['jquery']
    },
    'ngBootstrap': ['angular'],
    'ngClassy': ['angular'],
    'ngHttpAuth': ['angular'],
    'ngLoadingBar': ['angular'],
    'ngRaven': ['angular'],
    'ngRoute': ['angular'],
    'ngSanitize': ['angular'],
    'ngRouter': ['angular'],
    'simple-slider': {
      deps: ['jquery']
    },
    'underscore': {
      exports: '_'
    }
  }
};
