from typing import Any

import pytest

from sentry.investigations.actors import parse_actor_reference
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test
from sentry.viewer_context import ActorId, ActorType


@pytest.mark.parametrize(
    ("actor_type", "actor_id", "allow_system"),
    [
        (None, 1, False),
        ("user", 0, False),
        ("user", True, False),
        ("user", 1.5, False),
        ("system", 1, True),
        ("agent", 1, False),
        ("unrecognized", 1, False),
    ],
)
def test_rejects_malformed_actor_reference(
    actor_type: str | None, actor_id: Any, allow_system: bool
) -> None:
    with pytest.raises(ValueError):
        parse_actor_reference(actor_type, actor_id, allow_system=allow_system)


class InvestigationTest(TestCase):
    def test_get_absolute_url(self) -> None:
        organization = self.create_organization(slug="org1")
        investigation = self.create_investigation(organization=organization)

        assert (
            investigation.get_absolute_url()
            == f"http://testserver/organizations/org1/seer/investigations/{investigation.id}/"
        )


@cell_silo_test
class InvestigationActorReferenceTest(TestCase):
    def test_creator_kinds_distinguish_equal_numeric_ids(self) -> None:
        human = self.create_investigation(
            organization=self.organization,
            created_by_actor_type=ActorType.USER,
            created_by_actor_id=self.user.id,
        )
        account = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            created_by_actor_type=ActorType.SERVICE_ACCOUNT,
            created_by_actor_id=self.user.id,
        )

        human.refresh_from_db()
        account.refresh_from_db()

        assert human.get_creator_actor_reference() == ActorId(ActorType.USER, self.user.id)
        assert account.get_creator_actor_reference() == ActorId(
            ActorType.SERVICE_ACCOUNT, self.user.id
        )
        assert human.get_creator_actor_reference() != account.get_creator_actor_reference()

    def test_legacy_creator_remains_absent_from_explicit_identity(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization, created_by=self.user
        )
        investigation.refresh_from_db()

        assert investigation.get_creator_actor_reference() is None
        assert investigation.created_by_id == self.user.id

    def test_malformed_creator_does_not_fall_back_to_legacy_user(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization, created_by=self.user
        )
        investigation.created_by_actor_type = ActorType.USER

        with pytest.raises(ValueError, match="positive integer"):
            investigation.get_creator_actor_reference()

    def test_system_creator_is_rejected(self) -> None:
        investigation = self.create_investigation(organization=self.organization)
        investigation.created_by_actor_type = ActorType.SYSTEM

        with pytest.raises(ValueError, match="Unsupported"):
            investigation.get_creator_actor_reference()
