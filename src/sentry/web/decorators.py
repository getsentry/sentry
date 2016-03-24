from __future__ import absolute_import

from functools import wraps
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect

from sentry.web.helpers import render_to_response, get_login_url


def login_required(func):
    @wraps(func)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated():
            request.session['_next'] = request.get_full_path()
            if 'organization_slug' in kwargs:
                redirect_uri = reverse('sentry-auth-organization',
                                       args=[kwargs['organization_slug']])
            else:
                redirect_uri = get_login_url()
            return HttpResponseRedirect(redirect_uri)
        return func(request, *args, **kwargs)
    return wrapped


def requires_admin(func):
    @wraps(func)
    def wrapped(request, *args, **kwargs):
        if not request.is_superuser():
            return render_to_response('sentry/missing_permissions.html', {}, request, status=400)
        return func(request, *args, **kwargs)
    return login_required(wrapped)
