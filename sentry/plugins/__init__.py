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
            if not cls.slug:
                cls.slug = cls.title.replace(' ', '-').lower()
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

    slug = None

    def __init__(self):
        self.url = reverse('sentry-plugin-action', args=(self.slug,))

    def __call__(self, request):
        self.selected = request.META['PATH_INFO'] == self.url
        if not self.selected:
            return

        return self.perform(request)

class GroupActionProvider:
    __metaclass__ = PluginMount

    slug = None
    
    def __init__(self, group_id):
        self.url = reverse('sentry-group-plugin-action', args=(group_id, self.slug))
    
    def __call__(self, request, group):
        self.selected = request.META['PATH_INFO'] == self.url
        if not self.selected:
            return
        
        return self.perform(request, group)
    