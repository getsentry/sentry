# Based on http://martyalchin.com/2008/jan/10/simple-plugin-framework/
from django.core.urlresolvers import reverse

class PluginMount(type):
    def __init__(cls, name, bases, attrs):
        if not hasattr(cls, 'plugins'):
            # This branch only executes when processing the mount point itself.
            # So, since this is a new plugin type, not an implementation, this
            # class shouldn't be registered as a plugin. Instead, it sets up a
            # list where plugins can be registered later.
            cls.plugins = {}
        else:
            # This must be a plugin implementation, which should be registered.
            # Simply appending it to the list is all that's needed to keep
            # track of it later.
            cls.slug = getattr(cls, 'slug', None) or cls.title.replace(' ', '-').lower()
            cls.plugins[cls.slug] = cls

class ActionProvider:
    """
    Base interface for adding action providers.

    Plugins implementing this reference should provide the following attributes:

    ========  ========================================================
    title     The text to be displayed, describing the action

    view      The view which will perform this action

    selected  Boolean indicating whether the action is the one
              currently being performed
    
    ========  ========================================================
    """
    __metaclass__ = PluginMount

    def __init__(self):
        self.url = reverse('sentry-plugin-action', args=(self.slug,))

    def __call__(self, request):
        self.selected = request.path == self.url
        if not self.selected:
            return

        return self.perform(request)

class GroupActionProvider:
    # TODO: should be able to specify modal support

    __metaclass__ = PluginMount
    
    new_window = False

    @classmethod
    def get_url(cls, group_id):
        return reverse('sentry-group-plugin-action', args=(group_id, cls.slug))

    def __init__(self, group_id):
        self.url = self.__class__.get_url(group_id)

    def __call__(self, request, group):
        self.selected = request.path == self.url
        if not self.selected:
            return
        return self.view(request, group)

    def view(self):
        """
        Handles the view logic. If no response is given, we continue to the next action provider.
        """

    def tags(self, request, tag_list, group):
        """Modifies the tag list for a grouped message."""
        return tag_list

    def actions(self, request, action_list, group):
        """Modifies the action list for a grouped message."""
        return action_list

    def panels(self, request, panel_list, group):
        """Modifies the panel list for a grouped message."""
        return panel_list

    def widget(self, request, group):
        """
        Renders as a widget in the group details sidebar.
        """
