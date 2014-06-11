define([
    'backbone',
    'jquery',
    'moment',
    'underscore'
], function(Backbone, $, moment, _){
    'use strict';

    return {
        ScoredList: Backbone.Collection.extend({
            comparator: function(member){
                return -member.get('score');
            }
        })
    };
});
