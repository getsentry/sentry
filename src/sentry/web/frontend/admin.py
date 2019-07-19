"""
sentry.web.frontend.admin
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.http import HttpResponse, HttpResponseRedirect

from sentry.plugins import plugins
from sentry.utils import auth
from sentry.web.helpers import render_to_response


def configure_plugin(request, slug):
    plugin = plugins.get(slug)
    if not plugin.has_site_conf():
        return HttpResponseRedirect(auth.get_login_url())

    view = plugin.configure(request=request)
    if isinstance(view, HttpResponse):
        return view

    return render_to_response(
        'sentry/admin/plugins/configure.html', {
            'plugin': plugin,
            'title': plugin.get_conf_title(),
            'slug': plugin.slug,
            'view': view,
        }, request
    )
