from __future__ import absolute_import

from django.contrib.auth import logout, REDIRECT_FIELD_NAME
from django.contrib.auth.models import AnonymousUser
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from sudo.utils import is_safe_url

from sentry.web.frontend.base import BaseView
from sentry.utils import auth


class AuthLogoutView(BaseView):
    auth_required = False

    def redirect(self, request):
        next = request.GET.get(REDIRECT_FIELD_NAME, '')
        if not is_safe_url(next, host=request.get_host()):
            next = auth.get_login_url()
        return super(AuthLogoutView, self).redirect(next)

    def dispatch(self, request):
        if not request.user.is_authenticated():
            return self.redirect(request)
        return super(AuthLogoutView, self).dispatch(request)

    def get(self, request):
        return self.respond('sentry/logout.html')

    @method_decorator(csrf_protect)
    def post(self, request):
        if 'all' in request.POST:
            # Rotate all session tokens
            request.user.refresh_session_nonce(request)
            request.user.save()
        logout(request)
        request.user = AnonymousUser()
        return self.redirect(request)
