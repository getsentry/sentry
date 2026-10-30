from unittest.mock import patch

from sentry.hybridcloud.models import ApiKeyReplica
from sentry.hybridcloud.models.outbox import ControlOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.models.apikey import ApiKey
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class OrganizationApiKeyIndex(APITestCase):
    endpoint = "sentry-api-0-organization-api-key-index"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_org_admin_can_access(self) -> None:
        self.get_success_response(self.organization.slug)

    def test_member_no_access(self) -> None:
        user = self.create_user("bar@example.com")
        self.create_member(organization=self.organization, user=user, role="member")

        self.login_as(user)
        self.get_error_response(self.organization.slug, status_code=403)

    def test_superuser_can_access(self) -> None:
        admin_user = self.create_user("admin@example.com", is_superuser=True)
        self.create_member(organization=self.organization, user=admin_user, role="admin")

        self.login_as(admin_user, superuser=True)
        self.get_success_response(self.organization.slug)

    def test_outbox_flush_failure_returns_key(self) -> None:
        with patch.object(
            ApiKey, "handle_async_replication", side_effect=Exception("replication failed")
        ) as mock_replication:
            response = self.get_success_response(
                self.organization.slug, method="post", status_code=201
            )

        mock_replication.assert_called()
        key = ApiKey.objects.get(organization_id=self.organization.id)
        assert response.data["id"] == str(key.id)
        assert ControlOutbox.objects.filter(
            category=OutboxCategory.API_KEY_UPDATE, object_identifier=key.id
        ).exists()

        # At this point, the token change has been committed, but the outbox
        # has not been processed, so there should be no replica.
        with assume_test_silo_mode(SiloMode.CELL):
            assert not ApiKeyReplica.objects.filter(apikey_id=key.id).exists()

        with outbox_runner():
            pass

        with assume_test_silo_mode(SiloMode.CELL):
            assert ApiKeyReplica.objects.filter(apikey_id=key.id).exists()
