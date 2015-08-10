from __future__ import absolute_import

from django.template import Context, Template
from debug_toolbar.panels import Panel

TEMPLATE = Template("""
{% load i18n %}
<h4>{% trans "Route" %}</h4>
<table>
    <tr>
        <th>Response Code</th>
        <td>{{ response_code }}</td>
    </tr>
    <tr>
        <th>View</th>
        <td><code>{{ view_path }}</code></td>
    </tr>
    <tr>
        <th>Args</th>
        <td><code>{{ view_argspec }}</code></td>
    </tr>
</table>
""")


class RoutePanel(Panel):
    title = "Route"

    template = 'sentry/debug/panels/route.html'

    has_content = True

    def _get_func_name(self, func):
        if hasattr(func, 'im_class'):
            return '{}.{}.{}'.format(
                func.__module__,
                func.im_class.__name__,
                func.__name__,
            )
        return '{}.{}'.format(func.__module__, func.__name__)

    def _get_func_argspec(self, args, kwargs):
        result = []
        for arg in args:
            result.append(arg)
        for pair in kwargs.items():
            result.append(u'%s=%s' % tuple(pair))
        return u', '.join(result)

    def nav_subtitle(self):
        stats = self.get_stats()
        return stats['view_name']

    @property
    def content(self):
        stats = self.get_stats()
        return TEMPLATE.render(Context(stats))

    def process_view(self, request, view_func, view_args, view_kwargs):
        self._view = [view_func, view_args, view_kwargs]

    def process_response(self, request, response):
        stats = {}
        if hasattr(self, '_view'):
            view_func, view_args, view_kwargs = self._view
            stats['response_code'] = response.status_code
            stats['view_name'] = view_func.__name__
            stats['view_path'] = self._get_func_name(view_func)
            stats['view_argspec'] = self._get_func_argspec(view_args, view_kwargs)
        self.record_stats(stats)
