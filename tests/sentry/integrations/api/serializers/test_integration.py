from unittest.mock import patch

import pytest

from sentry.api.serializers import serialize
from sentry.integrations.api.serializers.models.integration import OrganizationIntegrationSerializer
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OrganizationIntegrationSerializerTest(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.integration, self.org_integration = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="example",
            name="Example",
            external_id="example:1",
        )

    def test_serialize(self) -> None:
        result = serialize(self.org_integration, self.user, OrganizationIntegrationSerializer())
        assert result["id"] == str(self.integration.id)
        assert result["externalId"] == self.integration.external_id
        assert result["organizationId"] == self.organization.id

    def test_serialize_raises_when_integration_config_serializer_fails(self) -> None:
        """When IntegrationConfigSerializer fails (returns None via _serialize), the
        OrganizationIntegrationSerializer should raise a clear exception rather than an
        AttributeError from calling .update() on None."""
        serializer = OrganizationIntegrationSerializer()
        attrs = serializer.get_attrs([self.org_integration], self.user)

        with patch(
            "sentry.integrations.api.serializers.models.integration.IntegrationConfigSerializer.serialize",
            side_effect=Exception("boom"),
        ):
            with pytest.raises(Exception, match=r"Failed to serialize integration \d+"):
                serializer.serialize(self.org_integration, attrs[self.org_integration], self.user)
