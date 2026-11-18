from uuid import uuid4

import pytest

from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.service_accounts.models import (
    ServiceAccount,
    ServiceAccountOwnerKind,
    parse_grantable_scopes,
)
from sentry.service_accounts.outbox import (
    ServiceAccountCreatePayload,
    service_account_create_outbox,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, cell_silo_test


@cell_silo_test
class ServiceAccountCreateOutboxTest(TestCase):
    def test_organization_owner_kind_is_refused(self) -> None:
        with pytest.raises(ValueError):
            service_account_create_outbox(
                organization_id=self.organization.id,
                owner_kind=ServiceAccountOwnerKind.ORGANIZATION,
                owner_id=1,
                name="nightly-triage",
                scope_list=parse_grantable_scopes(["event:read"]),
            )

    def test_organization_owner_kind_payload_is_dropped_without_blocking_the_shard(self) -> None:
        payload: ServiceAccountCreatePayload = {
            "owner_kind": ServiceAccountOwnerKind.ORGANIZATION.value,
            "owner_id": 1,
            "name": "nightly-triage",
            "scope_list": ["event:read"],
            "project_ids": [],
            "all_projects": False,
            "created_by_id": None,
            "idempotency_key": uuid4().hex,
        }
        outbox = CellOutbox(
            shard_scope=OutboxScope.SERVICE_ACCOUNT_SCOPE,
            shard_identifier=self.organization.id,
            category=OutboxCategory.SERVICE_ACCOUNT_CREATE,
            object_identifier=CellOutbox.next_object_identifier(),
            payload=payload,
        )
        outbox.save()

        outbox.drain_shard()

        assert not CellOutbox.objects.filter(
            category=OutboxCategory.SERVICE_ACCOUNT_CREATE
        ).exists()
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not ServiceAccount.objects.filter(organization_id=self.organization.id).exists()
