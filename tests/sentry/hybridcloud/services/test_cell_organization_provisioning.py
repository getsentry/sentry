from collections.abc import Generator
from contextlib import contextmanager
from typing import NamedTuple
from unittest import mock

from django.db import router, transaction
from django.dispatch import Signal

from sentry import audit_log
from sentry.analytics.events.data_consent_org_creation import (
    AggregatedDataConsentOrganizationCreatedEvent,
)
from sentry.analytics.events.organization_created import OrganizationCreatedEvent
from sentry.hybridcloud.models.outbox import CellOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.hybridcloud.services.cell_organization_provisioning import (
    cell_organization_provisioning_rpc_service,
)
from sentry.hybridcloud.services.control_organization_provisioning import (
    RpcOrganizationSlugReservation,
)
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.organizationslugreservation import (
    OrganizationSlugReservation,
    OrganizationSlugReservationType,
)
from sentry.models.team import Team
from sentry.services.organization import (
    OrganizationOptions,
    OrganizationProvisioningOptions,
    PostProvisionOptions,
)
from sentry.signals import organization_created, terms_accepted
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import get_matching_analytics_events
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test, create_test_cells
from sentry.users.models.user import User
from sentry.users.services.user.serial import serialize_generic_user


class ProvisioningCapture(NamedTuple):
    result: bool
    mock_record: mock.MagicMock
    terms_handler: mock.Mock
    created_handler: mock.Mock


@assume_test_silo_mode(SiloMode.CONTROL)
def get_org_add_audit_logs(organization_id: int) -> list[AuditLogEntry]:
    return list(
        AuditLogEntry.objects.filter(
            organization_id=organization_id, event=audit_log.get_event_id("ORG_ADD")
        )
    )


@contextmanager
def catch_signal(signal: Signal) -> Generator[mock.Mock]:
    handler = mock.Mock()
    signal.connect(handler)
    try:
        yield handler
    finally:
        signal.disconnect(handler)


@control_silo_test(cells=create_test_cells("us"))
class TestRegionOrganizationProvisioningCreateInControl(TestCase):
    def get_provisioning_args(
        self, user: User, is_test: bool = False, create_default_team: bool = True
    ) -> OrganizationProvisioningOptions:
        rpc_user = serialize_generic_user(user)
        assert rpc_user
        return OrganizationProvisioningOptions(
            provision_options=OrganizationOptions(
                name="Santry",
                slug="santry",
                owner=rpc_user,
                is_test=is_test,
                create_default_team=create_default_team,
                ip_address="127.0.0.1",
                agree_terms=True,
                aggregated_data_consent=True,
                channel_name="test-channel",
            ),
            post_provision_options=PostProvisionOptions(),
        )

    def organization_matches_provisioning_args(
        self, organization_id: int, provisioning_options: OrganizationProvisioningOptions
    ) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            org: Organization = Organization.objects.get(id=organization_id)
            assert org.slug == provisioning_options.provision_options.slug
            assert org.name == provisioning_options.provision_options.name
            assert org.get_default_owner().id == provisioning_options.provision_options.owner.id
        assert org.is_test == provisioning_options.provision_options.is_test

    def assert_has_default_team_and_membership(self, organization_id: int, user_id: int) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            org_membership = OrganizationMember.objects.get(
                organization_id=organization_id, user_id=user_id
            )
            team = Team.objects.get(organization_id=organization_id)
            OrganizationMemberTeam.objects.get(
                team_id=team.id, organizationmember_id=org_membership.id
            )

    def test_provisions_when_no_conflicting_orgs(self) -> None:
        user = self.create_user()
        provision_options = self.get_provisioning_args(user)
        organization_id = 42
        result = cell_organization_provisioning_rpc_service.create_organization_in_cell(
            organization_id=organization_id, provision_payload=provision_options, cell_name="us"
        )

        assert result
        self.organization_matches_provisioning_args(
            organization_id=organization_id, provisioning_options=provision_options
        )
        self.assert_has_default_team_and_membership(organization_id, user.id)

    def test_provisions_test_org_without_default_team(self) -> None:
        user = self.create_user()
        provision_options = self.get_provisioning_args(user, create_default_team=False)
        organization_id = 42
        result = cell_organization_provisioning_rpc_service.create_organization_in_cell(
            organization_id=organization_id, provision_payload=provision_options, cell_name="us"
        )

        assert result
        self.organization_matches_provisioning_args(
            organization_id=organization_id, provisioning_options=provision_options
        )

        with assume_test_silo_mode(SiloMode.CELL):
            assert not Team.objects.filter(organization_id=organization_id).exists()

    def test_provisions_when_fully_conflicting_org_has_matching_owner(self) -> None:
        user = self.create_user()
        organization_id = 42
        existing_org = self.create_organization(
            id=organization_id, slug="santry", name="Santry", owner=user
        )
        assert existing_org.id == organization_id

        provision_options = self.get_provisioning_args(user, create_default_team=False)
        result = cell_organization_provisioning_rpc_service.create_organization_in_cell(
            organization_id=organization_id, provision_payload=provision_options, cell_name="us"
        )

        assert result
        self.organization_matches_provisioning_args(
            organization_id=organization_id, provisioning_options=provision_options
        )

    def test_does_not_provision_and_returns_false_when_multiple_orgs_conflict(self) -> None:
        organization_id = 42
        # Org with a matching id
        self.create_organization(
            id=organization_id, slug="newsantry", name="NewSantry", owner=self.create_user()
        )

        # Org with a matching slug
        self.create_organization(slug="santry", name="Santry", owner=self.create_user())

        provisioning_user = self.create_user()
        provision_options = self.get_provisioning_args(provisioning_user, create_default_team=False)
        result = cell_organization_provisioning_rpc_service.create_organization_in_cell(
            organization_id=organization_id, provision_payload=provision_options, cell_name="us"
        )

        assert not result

        with assume_test_silo_mode(SiloMode.CELL):
            # Ensure that the user has not been added to any orgs since provisioning failed
            provisioning_user_memberships = OrganizationMember.objects.filter(
                user_id=provisioning_user.id
            )
        assert not provisioning_user_memberships.exists()

    def test_truncates_name_when_too_long(self) -> None:
        user = self.create_user()
        provision_options = self.get_provisioning_args(user)
        provision_options.provision_options.name = "a" * 128
        result = cell_organization_provisioning_rpc_service.create_organization_in_cell(
            organization_id=42, provision_payload=provision_options, cell_name="us"
        )

        assert result is True
        with assume_test_silo_mode(SiloMode.CELL):
            org: Organization = Organization.objects.get(id=42)
            assert org.name == "a" * 64

    def test_does_not_provision_and_returns_false_when_conflicting_org_with_different_owner(
        self,
    ) -> None:
        organization_id = 42
        self.create_organization(
            id=organization_id, slug="santry", name="Santry", owner=self.create_user()
        )

        provisioning_user = self.create_user()
        provision_options = self.get_provisioning_args(provisioning_user)
        result = cell_organization_provisioning_rpc_service.create_organization_in_cell(
            organization_id=organization_id, provision_payload=provision_options, cell_name="us"
        )

        assert not result

        with assume_test_silo_mode(SiloMode.CELL):
            provisioning_user_memberships = OrganizationMember.objects.filter(
                user_id=provisioning_user.id
            )
        assert not provisioning_user_memberships.exists()

    def test_does_not_provision_when_organization_id_already_in_use(
        self,
    ) -> None:
        organization_id = 42
        user = self.create_user()
        self.create_organization(
            id=organization_id, slug="something-different", name="Santry", owner=user
        )

        provision_options = self.get_provisioning_args(user)
        result = cell_organization_provisioning_rpc_service.create_organization_in_cell(
            organization_id=organization_id, provision_payload=provision_options, cell_name="us"
        )

        assert not result
        with assume_test_silo_mode(SiloMode.CELL):
            assert not Organization.objects.filter(
                slug=provision_options.provision_options.slug
            ).exists()

    def test_does_not_provision_when_organization_slug_already_in_use(
        self,
    ) -> None:
        organization_id = 42
        user = self.create_user()
        self.create_organization(slug="santry", name="Santry", owner=user)

        provision_options = self.get_provisioning_args(user)
        result = cell_organization_provisioning_rpc_service.create_organization_in_cell(
            organization_id=organization_id, provision_payload=provision_options, cell_name="us"
        )

        assert not result

        with assume_test_silo_mode(SiloMode.CELL):
            assert not Organization.objects.filter(id=organization_id).exists()

    def test_streamline_only_is_true(self) -> None:
        """
        All new organizations should never see the legacy UI.
        """
        user = self.create_user()
        provision_options = self.get_provisioning_args(user)
        organization_id = 42
        cell_organization_provisioning_rpc_service.create_organization_in_cell(
            organization_id=organization_id,
            provision_payload=provision_options,
            cell_name="us",
        )
        with assume_test_silo_mode(SiloMode.CELL):
            org: Organization = Organization.objects.get(id=organization_id)
            assert OrganizationOption.objects.get_value(org, "sentry:streamline_ui_only")

    def provision_and_capture(
        self, organization_id: int, provision_options: OrganizationProvisioningOptions
    ) -> ProvisioningCapture:
        # Audit logs are delivered via outbox in both flows.
        with (
            mock.patch("sentry.analytics.record") as mock_record,
            catch_signal(terms_accepted) as terms_handler,
            catch_signal(organization_created) as created_handler,
            outbox_runner(),
        ):
            result = cell_organization_provisioning_rpc_service.create_organization_in_cell(
                organization_id=organization_id,
                provision_payload=provision_options,
                cell_name="us",
            )
        return ProvisioningCapture(
            result=result,
            mock_record=mock_record,
            terms_handler=terms_handler,
            created_handler=created_handler,
        )

    def assert_analytics_and_audit_logs(
        self, *, organization_id: int, user: User, capture: ProvisioningCapture, sender: object
    ) -> None:
        assert capture.result
        with assume_test_silo_mode(SiloMode.CELL):
            org = Organization.objects.get(id=organization_id)
            assert org.get_option("sentry:aggregated_data_consent") is True

        audit_logs = get_org_add_audit_logs(organization_id)
        assert len(audit_logs) == 1
        assert audit_logs[0].target_object == organization_id
        assert audit_logs[0].actor_id == user.id
        assert audit_logs[0].actor_label == "provision_channel:test-channel"
        assert audit_logs[0].ip_address == "127.0.0.1"
        assert audit_logs[0].data["channel"] == "test-channel"

        assert get_matching_analytics_events(capture.mock_record, OrganizationCreatedEvent) == [
            OrganizationCreatedEvent(
                id=organization_id,
                name=org.name,
                slug=org.slug,
                actor_id=user.id,
            )
        ]
        assert get_matching_analytics_events(
            capture.mock_record, AggregatedDataConsentOrganizationCreatedEvent
        ) == [AggregatedDataConsentOrganizationCreatedEvent(organization_id=organization_id)]

        assert capture.terms_handler.call_count == 1
        terms_kwargs = capture.terms_handler.call_args.kwargs
        assert terms_kwargs["user"].id == user.id
        assert terms_kwargs["organization_id"] == organization_id
        assert terms_kwargs["ip_address"] == "127.0.0.1"
        assert terms_kwargs["sender"] == sender

        assert capture.created_handler.call_count == 1
        created_kwargs = capture.created_handler.call_args.kwargs
        assert created_kwargs["organization"].id == organization_id
        assert created_kwargs["user"].id == user.id
        assert created_kwargs["sender"] == sender

    def assert_minimal_analytics_and_audit_logs(
        self, *, organization_id: int, user: User, capture: ProvisioningCapture, sender: object
    ) -> None:
        assert capture.result
        with assume_test_silo_mode(SiloMode.CELL):
            org = Organization.objects.get(id=organization_id)
            assert not OrganizationOption.objects.get_value(org, "sentry:aggregated_data_consent")

        audit_logs = get_org_add_audit_logs(organization_id)
        assert len(audit_logs) == 1
        assert audit_logs[0].actor_id == user.id
        assert audit_logs[0].actor_label == user.username
        assert audit_logs[0].ip_address is None
        assert "channel" not in audit_logs[0].data

        assert (
            len(get_matching_analytics_events(capture.mock_record, OrganizationCreatedEvent)) == 1
        )
        assert not get_matching_analytics_events(
            capture.mock_record, AggregatedDataConsentOrganizationCreatedEvent
        )
        assert not capture.terms_handler.called

        assert capture.created_handler.call_count == 1
        assert capture.created_handler.call_args.kwargs["sender"] == sender

    def assert_no_analytics_or_audit_logs(
        self, *, organization_id: int, capture: ProvisioningCapture
    ) -> None:
        assert not capture.result
        assert not get_org_add_audit_logs(organization_id)
        assert not get_matching_analytics_events(capture.mock_record, OrganizationCreatedEvent)
        assert not get_matching_analytics_events(
            capture.mock_record, AggregatedDataConsentOrganizationCreatedEvent
        )
        assert not capture.terms_handler.called
        assert not capture.created_handler.called

    def get_minimal_provisioning_args(self, user: User) -> OrganizationProvisioningOptions:
        provision_options = self.get_provisioning_args(user)
        provision_options.provision_options.ip_address = None
        provision_options.provision_options.agree_terms = False
        provision_options.provision_options.aggregated_data_consent = False
        provision_options.provision_options.channel_name = None
        return provision_options

    def create_conflicting_org(self, organization_id: int) -> None:
        self.create_organization(
            id=organization_id, slug="santry", name="Santry", owner=self.create_user()
        )

    def test_creates_analytics_and_audit_logs(self) -> None:
        user = self.create_user()
        capture = self.provision_and_capture(42, self.get_provisioning_args(user))

        self.assert_analytics_and_audit_logs(
            organization_id=42,
            user=user,
            capture=capture,
            sender="provision_analytics",
        )

    def test_creates_analytics_and_audit_logs_with_outbox(self) -> None:
        user = self.create_user()
        capture = self.provision_and_capture(42, self.get_provisioning_args(user))

        self.assert_analytics_and_audit_logs(
            organization_id=42, user=user, capture=capture, sender="provision_analytics"
        )

    def test_creates_analytics_and_audit_logs_minimal_options_with_outbox(self) -> None:
        user = self.create_user()
        capture = self.provision_and_capture(42, self.get_minimal_provisioning_args(user))

        self.assert_minimal_analytics_and_audit_logs(
            organization_id=42, user=user, capture=capture, sender="provision_analytics"
        )

    def test_no_analytics_or_audit_logs_when_provisioning_fails(self) -> None:
        self.create_conflicting_org(42)
        capture = self.provision_and_capture(42, self.get_provisioning_args(self.create_user()))

        self.assert_no_analytics_or_audit_logs(organization_id=42, capture=capture)
        with assume_test_silo_mode(SiloMode.CELL):
            assert not CellOutbox.objects.filter(
                category=OutboxCategory.ORGANIZATION_PROVISION_ANALYTICS
            ).exists()


@control_silo_test(cells=create_test_cells("us"))
class TestRegionOrganizationProvisioningUpdateOrganizationSlug(TestCase):
    def setUp(self) -> None:
        self.provisioning_user = self.create_user()
        self.provisioned_org = self.create_organization(
            name="Santry", slug="santry", owner=self.provisioning_user
        )

    def create_temporary_slug_res(self, organization: Organization, slug: str, cell: str) -> None:
        with (
            assume_test_silo_mode(SiloMode.CONTROL),
            outbox_context(transaction.atomic(router.db_for_write(OrganizationSlugReservation))),
        ):
            OrganizationSlugReservation(
                reservation_type=OrganizationSlugReservationType.TEMPORARY_RENAME_ALIAS,
                slug=slug,
                organization_id=organization.id,
                cell_name=cell,
                user_id=-1,
            ).save(unsafe_write=True)

    def create_rpc_organization_slug_reservation(self, slug: str) -> RpcOrganizationSlugReservation:
        return RpcOrganizationSlugReservation(
            id=7,
            slug=slug,
            organization_id=self.provisioned_org.id,
            user_id=self.provisioning_user.id,
            cell_name="us",
            reservation_type=OrganizationSlugReservationType.TEMPORARY_RENAME_ALIAS.value,
        )

    def test_updates_org_slug_when_no_conflicts(self) -> None:
        desired_slug = "new-santry"
        # We have to create a temporary slug reservation in order for org mapping drains to proceed
        self.create_temporary_slug_res(
            organization=self.provisioned_org, cell="us", slug=desired_slug
        )
        result = (
            cell_organization_provisioning_rpc_service.update_organization_slug_from_reservation(
                cell_name="us",
                org_slug_temporary_alias_res=self.create_rpc_organization_slug_reservation(
                    desired_slug
                ),
            )
        )

        assert result
        with assume_test_silo_mode(SiloMode.CELL):
            updated_org = Organization.objects.get(id=self.provisioned_org.id)
        assert updated_org.slug == desired_slug

    def test_returns_true_if_organization_slug_already_updated(self) -> None:
        result = (
            cell_organization_provisioning_rpc_service.update_organization_slug_from_reservation(
                cell_name="us",
                org_slug_temporary_alias_res=self.create_rpc_organization_slug_reservation(
                    self.provisioned_org.slug
                ),
            )
        )

        assert result
        with assume_test_silo_mode(SiloMode.CELL):
            updated_org = Organization.objects.get(id=self.provisioned_org.id)
        assert updated_org.slug == self.provisioned_org.slug

    def test_fails_if_organization_not_found(self) -> None:
        rpc_org_slug_res = self.create_rpc_organization_slug_reservation("new-santry")
        with assume_test_silo_mode(SiloMode.CELL):
            self.provisioned_org.delete()

        result = (
            cell_organization_provisioning_rpc_service.update_organization_slug_from_reservation(
                cell_name="us",
                org_slug_temporary_alias_res=rpc_org_slug_res,
            )
        )

        assert not result
        with assume_test_silo_mode(SiloMode.CELL):
            assert not Organization.objects.filter(slug="new-santry").exists()

    def test_does_not_update_slug_when_conflict_exists(self) -> None:
        desired_slug = "new-sentry"
        self.create_organization(slug=desired_slug, name="conflicted org", owner=self.create_user())
        result = (
            cell_organization_provisioning_rpc_service.update_organization_slug_from_reservation(
                cell_name="us",
                org_slug_temporary_alias_res=self.create_rpc_organization_slug_reservation(
                    desired_slug
                ),
            )
        )

        assert not result
        with assume_test_silo_mode(SiloMode.CELL):
            org = Organization.objects.get(id=self.provisioned_org.id)
        assert org.slug == self.provisioned_org.slug
