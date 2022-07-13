from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.models import AnonymousUser
from django.core import signing
from django.http import HttpRequest

from sentry.auth.superuser import COOKIE_DOMAIN as SU_COOKIE_DOMAIN
from sentry.auth.superuser import COOKIE_NAME as SU_COOKIE_NAME
from sentry.auth.superuser import COOKIE_PATH as SU_COOKIE_PATH
from sentry.auth.superuser import COOKIE_SALT as SU_COOKIE_SALT
from sentry.auth.superuser import COOKIE_SECURE as SU_COOKIE_SECURE
from sentry.auth.superuser import ORG_ID as SU_ORG_ID
from sentry.auth.superuser import Superuser
from sentry.utils.auth import SsoSession
from sentry.utils.retries import TimedRetryPolicy


def save_cookie(client, name, value, **params):
    client.cookies[name] = value
    client.cookies[name].update({k.replace("_", "-"): v for k, v in params.items()})


def save_session(session, save_cookie):
    session.save()
    save_cookie(
        name=settings.SESSION_COOKIE_NAME,
        value=session.session_key,
        max_age=None,
        path="/",
        domain=settings.SESSION_COOKIE_DOMAIN,
        secure=settings.SESSION_COOKIE_SECURE or None,
        expires=None,
    )


# TODO(dcramer): ideally superuser_sso would be False by default, but that would require
# a lot of tests changing
@TimedRetryPolicy.wrap(timeout=5)
def login_as(
    session,
    save_cookie,
    save_session,
    user,
    organization_id=None,
    organization_ids=None,
    superuser=False,
    superuser_sso=True,
):
    user.backend = settings.AUTHENTICATION_BACKENDS[0]

    request = make_request(session)
    login(request, user)
    request.user = user

    if organization_ids is None:
        organization_ids = set()
    else:
        organization_ids = set(organization_ids)
    if superuser and superuser_sso is not False:
        if SU_ORG_ID:
            organization_ids.add(SU_ORG_ID)
    if organization_id:
        organization_ids.add(organization_id)

    # TODO(dcramer): ideally this would get abstracted
    if organization_ids:
        for o in organization_ids:
            sso_session = SsoSession.create(o)
            session[sso_session.session_key] = sso_session.to_dict()

    # logging in implicitly binds superuser, but for test cases we
    # want that action to be explicit to avoid accidentally testing
    # superuser-only code
    if not superuser:
        # XXX(dcramer): we're calling the internal method to avoid logging
        request.superuser._set_logged_out()
    elif request.user.is_superuser and superuser:
        request.superuser.set_logged_in(request.user)
        # XXX(dcramer): awful hack to ensure future attempts to instantiate
        # the Superuser object are successful
        save_cookie(
            name=SU_COOKIE_NAME,
            value=signing.get_cookie_signer(salt=SU_COOKIE_NAME + SU_COOKIE_SALT).sign(
                request.superuser.token
            ),
            max_age=None,
            path=SU_COOKIE_PATH,
            domain=SU_COOKIE_DOMAIN,
            secure=SU_COOKIE_SECURE or None,
            expires=None,
        )
    # Save the session values.
    save_session()


def make_request(session, user=None, auth=None, method=None, is_superuser=None):
    request = HttpRequest()
    if method:
        request.method = method
    request.META["REMOTE_ADDR"] = "127.0.0.1"
    request.META["SERVER_NAME"] = "testserver"
    request.META["SERVER_PORT"] = 80

    # order matters here, session -> user -> other things
    request.session = session
    request.auth = auth
    request.user = user or AnonymousUser()
    # must happen after request.user/request.session is populated
    request.superuser = Superuser(request)
    if is_superuser:
        # XXX: this is gross, but its a one off and apis change only once in a great while
        request.superuser.set_logged_in(user)
    request.is_superuser = lambda: request.superuser.is_active
    request.successful_authenticator = None
    return request
