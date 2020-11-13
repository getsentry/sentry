from __future__ import absolute_import

from random import randint

from sentry.models import ApiToken, Organization, User
from sentry.testutils import TestCase
from sentry.utils import ratelimits

# Produce faster tests by reducing the limits so we don't have to generate so amny
RELAXED_CONFIG = {
    "members:invite-by-user": {"limit": 5, "window": 3600 * 24},
    "members:invite-by-org": {"limit": 5, "window": 3600 * 24},
    "members:org-invite-to-email": {"limit": 2, "window": 3600 * 24},
}


class ForOrganizationMemberTestCase(TestCase):
    def test_by_email(self):
        organization = Organization(id=1)
        email = "foo@example.com"
        for n in range(2):
            assert not ratelimits.for_organization_member_invite(
                organization, email, config=RELAXED_CONFIG
            )

        assert ratelimits.for_organization_member_invite(organization, email, config=RELAXED_CONFIG)

    def test_by_organization(self):
        organization = Organization(id=1)
        for n in range(5):
            assert not ratelimits.for_organization_member_invite(
                organization, "{}@example.com".format(randint(0, 1000000)), config=RELAXED_CONFIG
            )

        assert ratelimits.for_organization_member_invite(
            organization, "anything@example.com", config=RELAXED_CONFIG
        )

    def test_by_api_token(self):
        token = ApiToken(id=1)
        for n in range(5):
            assert not ratelimits.for_organization_member_invite(
                Organization(id=randint(0, 100000)),
                "{}@example.com".format(randint(0, 1000000)),
                auth=token,
                config=RELAXED_CONFIG,
            )

        assert ratelimits.for_organization_member_invite(
            Organization(id=1), "anything@example.com", auth=token, config=RELAXED_CONFIG
        )

    def test_by_user(self):
        user = User(email="biz@example.com")
        for n in range(5):
            assert not ratelimits.for_organization_member_invite(
                Organization(id=randint(0, 100000)),
                "{}@example.com".format(randint(0, 1000000)),
                user=user,
                config=RELAXED_CONFIG,
            )

        assert ratelimits.for_organization_member_invite(
            Organization(id=1), "anything@example.com", user=user, config=RELAXED_CONFIG
        )
