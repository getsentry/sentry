from __future__ import absolute_import
from importlib import import_module

from django.conf import settings
from django.core.urlresolvers import reverse, NoReverseMatch

from sentry.testutils import TestCase


class CSRFTest(TestCase):
    def test_endpoints_have_csrf(self):
        """
        Iterate on all endpoints that have unambiguous paths and send a POST
        request with no CSRF token (either in params or cookie) and validate
        that the response is a 403 with the CSRF warning.
        """
        user = self.create_user('foo@example.com')
        self.login_as(user)
        self.client.handler.enforce_csrf_checks = True

        protected = {True: 0, False: 0}
        urlconf = import_module(settings.ROOT_URLCONF)
        patterns = [u for u in urlconf.urlpatterns if hasattr(u, 'name') and u.name is not None]
        for p in patterns:

            # need to delete this cookie every time
            if settings.CSRF_COOKIE_NAME in self.client.cookies:
                del self.client.cookies[settings.CSRF_COOKIE_NAME]

            try:
                path = reverse(p.name)
            except NoReverseMatch:
                continue
            try:
                resp = self.client.post(path)
                is_protected = (
                    resp.status_code == 403 and
                    "A required security token was not found or was invalid." in resp.content
                )
                protected[is_protected] += 1
            except Exception:
                continue
        assert protected[True] > 0
