from urllib.parse import urlparse

from django.test.client import RequestFactory
from django.urls import reverse

from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.region import get_local_region
from sentry.utils import linksign


@region_silo_test
class LinkSignTestCase(TestCase):
    def test_link_signing(self):
        base_url = get_local_region().to_url("/")
        assert base_url.startswith("http://")

        url = linksign.generate_signed_link(self.user, "sentry")
        assert url.startswith(base_url)

        url = linksign.generate_signed_link(self.user.id, "sentry")
        assert url.startswith(base_url)

        url = linksign.generate_signed_link(
            self.user.id,
            "sentry-customer-domain-unsubscribe-project",
            referrer="alert_view",
            kwargs={"project_id": 1},
        )

        assert url.startswith(base_url)
        assert "referrer=alert_view" in url
        assert "unsubscribe/project" in url

    def test_link_signing_custom_url_prefix(self):
        if SiloMode.get_current_mode() != SiloMode.MONOLITH:
            return
        rf = RequestFactory()
        # system.url-prefix only influences monolith behavior.
        # in siloed deployments url templates are used
        with self.options({"system.url-prefix": "https://sentry.io"}):
            url = linksign.generate_signed_link(self.user, "sentry")
            assert url.startswith("https://sentry.io")
            req = rf.get("/" + url.split("/", 3)[-1])
            signed_user = linksign.process_signature(req)
            assert signed_user
            assert signed_user.id == self.user.id

    def test_process_signature(self):
        rf = RequestFactory()
        url = linksign.generate_signed_link(self.user, "sentry")

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

    def test_generate_signed_unsubscribe_link_path_based(self):
        rf = RequestFactory()
        org = self.organization
        user = self.user
        url = linksign.generate_signed_unsubscribe_link(
            org, user_id=user.id, resource="project", resource_id=1, referrer="alert_notification"
        )

        assert f"http://testserver/unsubscribe/{org.slug}/project/1/" in url
        assert "referrer=alert_notification" in url
        assert "_=" in url

        # signature should be valid for the API endpoint
        parsed = urlparse(url)
        api_path = reverse("sentry-api-0-organization-unsubscribe-project", args=[org.slug, 1])
        req = rf.get(f"{api_path}?{parsed.query}")
        signed_user = linksign.process_signature(req)
        assert signed_user

    def test_generate_signed_unsubscribe_link_domain_based(self):
        rf = RequestFactory()
        org = self.organization
        user = self.user

        with self.feature("organizations:customer-domains"):
            url = linksign.generate_signed_unsubscribe_link(
                org,
                user_id=user.id,
                resource="project",
                resource_id=1,
                referrer="alert_notification",
            )

        assert f"http://{org.slug}.testserver/unsubscribe/project/1/" in url
        assert "referrer=alert_notification" in url
        assert "_=" in url

        # signature should be valid for the API endpoint
        parsed = urlparse(url)
        api_path = reverse("sentry-api-0-organization-unsubscribe-project", args=[org.slug, 1])
        req = rf.get(f"{api_path}?{parsed.query}")
        signed_user = linksign.process_signature(req)
        assert signed_user
