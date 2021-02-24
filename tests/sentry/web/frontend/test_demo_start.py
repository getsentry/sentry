import pytest
from sentry.utils.compat import mock

from django.template.defaultfilters import slugify
from django.core.urlresolvers import reverse
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

org_owner_email = "elon@tesla.com"
org_name = "Org Name"


class AuthLoginTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-demo-start")

    def test_404_disabled(self):
        with self.settings(DEMO_MODE=False, DEMO_ORG_OWNER_EMAIL=org_owner_email):
            resp = self.client.post(self.path)
            assert resp.status_code == 404

    @mock.patch("sentry.web.frontend.demo_start.generate_random_name", return_value=org_name)
    def test_basic(self, mock_generate_name):
        owner = User.objects.create(email=org_owner_email)
        with self.settings(DEMO_MODE=True, DEMO_ORG_OWNER_EMAIL=org_owner_email):
            resp = self.client.post(self.path)
            assert resp.status_code == 302

        org = Organization.objects.get(name=org_name)
        slug = slugify(org_name)
        email = create_fake_email(slug, "demo")
        user = User.objects.get(email=email)

        assert OrganizationMember.objects.filter(
            user=user, organization=org, role="member"
        ).exists()
        assert OrganizationMember.objects.filter(
            user=owner, organization=org, role="owner"
        ).exists()

        assert len(Project.objects.filter(organization=org)) == 2
        assert not ProjectKey.objects.filter(project__organization=org).exists()

    @mock.patch("sentry.web.frontend.demo_start.generate_random_name", return_value=org_name)
    def test_no_owner(self, mock_generate_name):
        with self.settings(DEMO_MODE=True, DEMO_ORG_OWNER_EMAIL=org_owner_email):
            with pytest.raises(Exception):
                self.client.post(self.path)

        # verify we are using atomic transactions
        assert not Organization.objects.filter(name=org_name).exists()
