(function(){
  'use strict';

  SentryApp.factory('GroupModel', function(){
    return function(data) {
      data.version = new Date().getTime();
      return data;
    };
  });
}());
