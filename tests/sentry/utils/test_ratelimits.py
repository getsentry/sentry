from __future__ import absolute_import

from random import randint

from sentry.models import ApiToken, Organization, User
from sentry.testutils import TestCase
from sentry.utils import ratelimits


class ForOrganizationMemberTestCase(TestCase):
    def test_by_email(self):
        organization = Organization(id=1)
        email = "foo@example.com"
        for n in range(10):
            assert not ratelimits.for_organization_member_invite(organization, email)

        assert ratelimits.for_organization_member_invite(organization, email)

    def test_by_organization(self):
        organization = Organization(id=1)
        for n in range(100):
            assert not ratelimits.for_organization_member_invite(
                organization, "{}@example.com".format(randint(0, 1000000))
            )

        assert ratelimits.for_organization_member_invite(organization, "anything@example.com")

    def test_by_api_token(self):
        token = ApiToken()
        for n in range(100):
            assert not ratelimits.for_organization_member_invite(
                Organization(id=randint(0, 100000)),
                "{}@example.com".format(randint(0, 1000000)),
                auth=token,
            )

        assert ratelimits.for_organization_member_invite(Organization(id=1), "anything@example.com")

    def test_by_user(self):
        user = User(email="biz@example.com")
        for n in range(100):
            assert not ratelimits.for_organization_member_invite(
                Organization(id=randint(0, 100000)),
                "{}@example.com".format(randint(0, 1000000)),
                user=user,
            )

        assert ratelimits.for_organization_member_invite(Organization(id=1), "anything@example.com")
