from django.test import override_settings
from django.test.client import RequestFactory

from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import linksign


@control_silo_test(stable=True)
class LinkSignTestCase(TestCase):
    @override_settings(ALLOWED_HOSTS=["something-else", "testserver"])
    def test_link_signing(self):
        rf = RequestFactory()

        url = linksign.generate_signed_link(self.user, "sentry")
        assert url.startswith("http://")

        req = rf.get("/" + url.split("/", 3)[-1])
        signed_user = linksign.process_signature(req)
        assert signed_user
        assert signed_user.id == self.user.id

        req = rf.get("/what" + url.split("/", 3)[-1])
        signed_user = linksign.process_signature(req)
        assert signed_user is None

        req = rf.get("/" + url.split("/", 3)[-1] + "garbage")
        signed_user = linksign.process_signature(req)
        assert signed_user is None

        rf.defaults["SERVER_NAME"] = "something-else"
        req = rf.get("/" + url.split("/", 3)[-1])
        signed_user = linksign.process_signature(req)
        assert signed_user is None
