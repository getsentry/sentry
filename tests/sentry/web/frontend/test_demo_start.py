import pytest
from sentry.utils.compat import mock

from django.test.utils import override_settings
from django.template.defaultfilters import slugify
from exam import fixture

from sentry.testutils import TestCase
from sentry.models import (
    User,
    Organization,
    OrganizationMember,
    Project,
    ProjectKey,
)
from sentry.utils.email import create_fake_email

org_owner_email = "james@example.com"
org_name = "Org Name"


class AuthLoginTest(TestCase):
    @fixture
    def path(self):
        return "/demo/start/"

    @override_settings(DEMO_MODE=True, DEMO_ORG_OWNER_EMAIL=org_owner_email)
    @mock.patch("sentry.web.frontend.demo_start.generate_random_name", return_value=org_name)
    def test_basic(self, mock_generate_name):
        owner = User.objects.create(email=org_owner_email)
        resp = self.client.get(self.path)
        assert resp.status_code == 302

        org = Organization.objects.get(name=org_name)
        assert org.flags.demo_mode
        slug = slugify(org_name)
        email = create_fake_email(slug, "demo")
        user = User.objects.get(email=email)
        assert user.flags.demo_mode

        assert OrganizationMember.objects.filter(
            user=user, organization=org, role="member"
        ).exists()
        assert OrganizationMember.objects.filter(
            user=owner, organization=org, role="owner"
        ).exists()

        assert len(Project.objects.filter(organization=org)) == 2
        assert not ProjectKey.objects.filter(project__organization=org).exists()

    @override_settings(DEMO_MODE=True, DEMO_ORG_OWNER_EMAIL=org_owner_email)
    @mock.patch("sentry.web.frontend.demo_start.generate_random_name", return_value=org_name)
    def test_no_owner(self, mock_generate_name):
        with pytest.raises(Exception):
            self.client.get(self.path)

        # verify we are using atomic transactions
        assert not Organization.objects.filter(name=org_name).exists()

    @override_settings(DEMO_MODE=False)
    def test_disabled(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 404
