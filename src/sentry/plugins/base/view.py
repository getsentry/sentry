from __future__ import absolute_import

__all__ = ['PluggableViewMixin']

from django.http import HttpResponseRedirect

from .response import Response


class PluggableViewMixin(object):
    """
    A mix-in which provides a render method which returns a special object to
    enable embedding of content within base-views.
    """
    def redirect(self, url):
        """
        Returns a redirect response type.
        """
        return HttpResponseRedirect(url)

    def render(self, template, context=None):
        """
        Given a template name, and an optional context (dictionary), returns a
        ready-to-render response.

        Default context includes the plugin instance.

        >>> self.render('template.html', {'hello': 'world'})
        """
        if context is None:
            context = {}
        context['plugin'] = self
        return Response(template, context)
