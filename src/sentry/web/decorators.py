from __future__ import absolute_import

from functools import wraps
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.contrib import messages
from django.utils.translation import ugettext_lazy as _

from sentry.utils import auth
from sentry.web.helpers import render_to_response

ERR_BAD_SIGNATURE = _('The link you followed is invalid or expired.')


def login_required(func):
    @wraps(func)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated():
            auth.initiate_login(request, next_url=request.get_full_path())
            if 'organization_slug' in kwargs:
                redirect_uri = reverse('sentry-auth-organization',
                                       args=[kwargs['organization_slug']])
            else:
                redirect_uri = auth.get_login_url()
            return HttpResponseRedirect(redirect_uri)
        return func(request, *args, **kwargs)
    return wrapped


def signed_auth_required(func):
    @wraps(func)
    def wrapped(request, *args, **kwargs):
        if not request.user_from_signed_request:
            messages.add_message(
                request, messages.ERROR, ERR_BAD_SIGNATURE)
            return HttpResponseRedirect(auth.get_login_url())
        return func(request, *args, **kwargs)
    return wrapped


def requires_admin(func):
    @wraps(func)
    def wrapped(request, *args, **kwargs):
        if not request.is_superuser():
            return render_to_response('sentry/missing_permissions.html', {},
                                      request, status=400)
        return func(request, *args, **kwargs)
    return login_required(wrapped)
