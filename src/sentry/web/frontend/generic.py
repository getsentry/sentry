"""
sentry.web.frontend.generic
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.http import HttpResponseRedirect
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext as _

from sentry.plugins import plugins
from sentry.plugins.base import Response
from sentry.web.helpers import render_to_response


def static_media(request, **kwargs):
    """
    Serve static files below a given point in the directory structure.
    """
    from django.contrib.staticfiles.views import serve

    module = kwargs.get('module')
    path = kwargs.get('path', '')

    if module:
        path = '%s/%s' % (module, path)

    return serve(request, path, insecure=True)


def missing_perm(request, perm, **kwargs):
    """
    Returns a generic response if you're missing permission to perform an
    action.

    Plugins may overwrite this with the ``missing_perm_response`` hook.
    """
    response = plugins.first('missing_perm_response', request, perm, **kwargs)

    if response:
        if isinstance(response, HttpResponseRedirect):
            return response

        if not isinstance(response, Response):
            raise NotImplementedError('Use self.render() when returning responses.')

        return response.respond(request, {
            'perm': perm,
        })

    if perm.label:
        return render_to_response('sentry/generic_error.html', {
            'title': _('Missing Permission'),
            'message': _('You do not have the required permissions to %s.') % (perm.label,)
        }, request)

    return HttpResponseRedirect(reverse('sentry'))
