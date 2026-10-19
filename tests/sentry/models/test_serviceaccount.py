from contextlib import AbstractContextManager

import pytest
from django.core.exceptions import ValidationError
from django.db import router, transaction

from sentry.hybridcloud.models.outbox import ControlOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.serviceaccount import ServiceAccount, validate_grantable_scopes
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


def test_validate_grantable_scopes_accepts_api_scopes() -> None:
    validate_grantable_scopes(["org:read", "project:write", "event:admin"])


@pytest.mark.parametrize("scope", ["openid", "profile", "email", "not:a-scope"])
def test_validate_grantable_scopes_rejects_non_grantable(scope: str) -> None:
    with pytest.raises(ValidationError):
        validate_grantable_scopes(["org:read", scope])


@control_silo_test
class ServiceAccountOutboxTest(TestCase):
    """
    Cells read service accounts through a cached RPC, and this outbox is what clears that cache,
    so every create, update and delete has to write one for the org's cell.
    """

    def unflushed_outboxes(self) -> AbstractContextManager[object]:
        return outbox_context(transaction.atomic(router.db_for_write(ServiceAccount)), flush=False)

    def assert_outbox_written(self, service_account_id: int, organization_id: int) -> None:
        outboxes = list(
            ControlOutbox.objects.filter(
                category=OutboxCategory.SERVICE_ACCOUNT_UPDATE,
                object_identifier=service_account_id,
            )
        )
        assert len(outboxes) == 1
        assert outboxes[0].shard_scope == OutboxScope.ORGANIZATION_SCOPE
        assert outboxes[0].shard_identifier == organization_id
        assert (
            outboxes[0].cell_name
            == OrganizationMapping.objects.get(organization_id=organization_id).cell_name
        )
        ControlOutbox.objects.filter(id=outboxes[0].id).delete()

    def test_writes_outbox_for_org_cell_on_every_change(self) -> None:
        organization = self.create_organization()

        with self.unflushed_outboxes():
            service_account = ServiceAccount.objects.create(
                organization_id=organization.id, name="seer-autofix", scope_list=["org:read"]
            )
        self.assert_outbox_written(service_account.id, organization.id)

        with self.unflushed_outboxes():
            service_account.update(is_active=False)
        self.assert_outbox_written(service_account.id, organization.id)

        service_account_id = service_account.id
        with self.unflushed_outboxes():
            service_account.delete()
        self.assert_outbox_written(service_account_id, organization.id)
