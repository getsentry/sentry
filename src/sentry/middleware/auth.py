from __future__ import absolute_import

from django.contrib import auth
from django.utils.functional import SimpleLazyObject
from django.dispatch import receiver
from sentry.utils.dates import to_datetime
from sentry.utils.auth import bump_session_timestamp


@receiver(auth.user_logged_in)
def on_user_logged_in(sender, request, user, **extra):
    if user.is_authenticated():
        bump_session_timestamp(request)


def get_user_safely(request):
    user = auth.get_user(request)

    if not user.is_authenticated() or user.last_password_change is None:
        return user

    login_time = request.session.get('_auth_ts')
    if login_time is not None:
        login_time = to_datetime(login_time)
    if login_time is None or login_time < user.last_password_change:
        request.session.clear()
        return auth.AnonymousUser()
    return user


class AuthenticationMiddleware(object):

    def process_request(self, request):
        request.user = SimpleLazyObject(lambda: get_user_safely(request))
