(function(){

  window.Event = Backbone.Model.extend({
  
    toggle: function() {
      this.save({done: !this.get("done")});
    },

    // Remove this Todo from *localStorage*, deleting its view.
    clear: function() {
      this.destroy();
      $(this.view.el).dispose();
    }
  
  });
}());