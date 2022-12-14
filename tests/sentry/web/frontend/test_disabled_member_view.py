from functools import cached_property

from django.urls import reverse

from sentry.models import OrganizationMember
from sentry.testutils import TestCase


class DisabledMemberViewTest(TestCase):
    @cached_property
    def path(self):
        return reverse("sentry-organization-disabled-member", args=[self.org.slug])

    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        self.user = self.create_user()
        self.login_as(self.user)

    def create_one_member(self, flags=None):
        self.create_member(user=self.user, organization=self.org, role="member", flags=flags)

    def test_member_disabled_can_load(self):
        self.create_one_member(
            flags=OrganizationMember.flags["member-limit:restricted"],
        )
        resp = self.client.get(self.path)
        assert resp.status_code == 200

    def test_member_active_member_redirect(self):
        self.create_one_member()
        resp = self.client.get(self.path)
        assert resp.status_code == 302
        redirect = reverse("sentry-organization-issue-list", args=[self.org.slug])
        assert redirect == resp["Location"]
