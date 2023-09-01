from unittest import mock

import pytest

from sentry.models.organizationmapping import OrganizationMapping
from sentry.notifications.helpers import is_double_write_enabled
from sentry.services.hybrid_cloud.organization_mapping.serial import serialize_organization_mapping
from sentry.testutils.cases import TestCase


class HelpersTest(TestCase):
    @mock.patch("sentry.notifications.helpers.features.has", return_value=False)
    def test_is_double_write_enabled_user(self, mock_has):
        # Create dummy users and organizations
        user1 = self.create_user()
        user2 = self.create_user()
        org1 = self.create_organization()
        org2 = self.create_organization()
        org3 = self.create_organization()

        # Add users to organizations
        self.create_member(user=user1, organization=org1)
        self.create_member(user=user2, organization=org2)
        self.create_member(user=user1, organization=org3)

        is_double_write_enabled(user_id=user1.id)

        mapped_org1 = OrganizationMapping.objects.get(organization_id=org1.id)
        mapped_org2 = OrganizationMapping.objects.get(organization_id=org2.id)
        mapped_org3 = OrganizationMapping.objects.get(organization_id=org3.id)
        # Ensure mock_has is called on the right organizations
        mock_has.assert_any_call(
            "organizations:notifications-double-write", serialize_organization_mapping(mapped_org1)
        )
        mock_has.assert_any_call(
            "organizations:notifications-double-write", serialize_organization_mapping(mapped_org3)
        )
        for call in mock_has.call_args_list:
            self.assertNotEqual(
                call[0],
                (
                    "organizations:notifications-double-write",
                    serialize_organization_mapping(mapped_org2),
                ),
            )

    @mock.patch("sentry.notifications.helpers.features.has", return_value=False)
    def test_is_double_write_enabled_team(self, mock_has):
        # Create dummy users and organizations
        org1 = self.create_organization()
        org2 = self.create_organization()

        team1 = self.create_team(organization=org1)
        self.create_team(organization=org2)

        is_double_write_enabled(team_id=team1.id)
        # Ensure mock_has is called on the right organizations
        mock_has.assert_any_call("organizations:notifications-double-write", org1)
        for call in mock_has.call_args_list:
            self.assertNotEqual(call[0], ("organizations:notifications-double-write", org2))

    def test_test_is_double_write_invalid_input(self):
        with pytest.raises(ValueError):
            is_double_write_enabled()
