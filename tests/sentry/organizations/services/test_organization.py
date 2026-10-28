from unittest import mock

from django.conf import settings
from django.db import connections, router
from django.test.utils import CaptureQueriesContext

from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc.service import dispatch_to_local_service
from sentry.hybridcloud.services.organization_mapping.serial import (
    serialize_organization_mapping_flags,
)
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.project import Project
from sentry.models.team import TeamStatus
from sentry.organizations.services.organization import RpcOrganizationMappingFlags
from sentry.organizations.services.organization.service import organization_service
from sentry.testutils.asserts import assert_no_organization_resource_hydration
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode_of


def count_organization_reads(queries: CaptureQueriesContext) -> int:
    return sum(
        f'FROM "{Organization._meta.db_table}" ' in query["sql"]
        for query in queries.captured_queries
    )


@all_silo_test
class ActiveOrganizationResourcesTest(TestCase):
    def test_active_resource_ids(self) -> None:
        org = self.create_organization()
        other_org = self.create_organization()
        team = self.create_team(organization=org)
        project = self.create_project(organization=org, teams=[team])
        unassigned = self.create_project(organization=org, teams=[])
        self.create_project(organization=other_org)
        self.create_project(organization=org, status=ObjectStatus.PENDING_DELETION)
        self.create_project(organization=org, status=ObjectStatus.DELETION_IN_PROGRESS)
        self.create_project(organization=org, status=ObjectStatus.DISABLED)
        self.create_team(organization=self.create_organization())
        self.create_team(organization=org, status=TeamStatus.PENDING_DELETION)
        self.create_team(organization=org, status=TeamStatus.DELETION_IN_PROGRESS)

        context = organization_service.get_access_context(
            organization_id=org.id, include_resource_ids=True
        )
        assert context is not None
        assert context.resource_ids is not None
        assert set(context.resource_ids.project_ids) == {project.id, unassigned.id}
        assert context.resource_ids.team_ids == [team.id]

    def test_validate_supplied_project_ids(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        self.create_project(organization=org)
        inactive = self.create_project(organization=org, status=ObjectStatus.DISABLED)
        foreign = self.create_project(organization=self.create_organization())

        assert organization_service.get_active_project_ids(
            organization_id=org.id, project_ids=[project.id, project.id, inactive.id, foreign.id]
        ) == [project.id]
        assert (
            organization_service.get_active_project_ids(organization_id=org.id, project_ids=[])
            == []
        )

    def test_empty_organization(self) -> None:
        org = self.create_organization()

        context = organization_service.get_access_context(
            organization_id=org.id, include_resource_ids=True
        )
        assert context is not None
        assert context.resource_ids is not None
        assert context.resource_ids.project_ids == []
        assert context.resource_ids.team_ids == []

    def test_member_context_does_not_load_organization_resources(self) -> None:
        org = self.create_organization(owner=self.user)
        team = self.create_team(organization=org, members=[self.user])
        project = self.create_project(organization=org, teams=[team])
        self.create_project(organization=org)
        with (
            assert_no_organization_resource_hydration(),
            mock.patch(
                "sentry.organizations.services.organization.impl.get_active_resource_ids",
                side_effect=AssertionError("Unexpected organization-wide resource lookup"),
            ) as resources,
        ):
            context = organization_service.get_access_context(
                organization_id=org.id, user_id=self.user.id
            )
        resources.assert_not_called()
        assert context is not None
        assert context.organization.id == org.id
        assert context.organization.projects == []
        assert context.organization.teams == []
        assert context.resource_ids is None
        assert context.member is not None
        assert context.member.user_id == self.user.id
        assert context.member.project_ids == [project.id]
        assert [t.team_id for t in context.member.member_teams] == [team.id]

    def test_access_context_rpc_serialization(self) -> None:
        org = self.create_organization()
        team = self.create_team(organization=org)
        project = self.create_project(organization=org, teams=[team])

        with assume_test_silo_mode_of(Project):
            response = dispatch_to_local_service(
                "organization",
                "get_access_context",
                {"organization_id": org.id, "include_resource_ids": True},
            )

        value = response["value"]
        assert value["organization"]["id"] == org.id
        assert value["organization"]["projects"] == []
        assert value["organization"]["teams"] == []
        assert value["resource_ids"] == {"project_ids": [project.id], "team_ids": [team.id]}

        with assume_test_silo_mode_of(Project):
            response = dispatch_to_local_service(
                "organization",
                "get_access_context_by_slug",
                {"slug": org.slug, "only_visible": True, "include_resource_ids": True},
            )
        assert response["value"] == value

    def test_access_contexts_read_organization_once(self) -> None:
        org = self.create_organization(owner=self.user)
        team = self.create_team(organization=org)
        project = self.create_project(organization=org, teams=[team])
        connection = connections[router.db_for_read(Organization)]

        with CaptureQueriesContext(connection) as by_id_queries:
            by_id = organization_service.get_access_context(
                organization_id=org.id, user_id=self.user.id
            )
        with CaptureQueriesContext(connection) as by_slug_queries:
            context = organization_service.get_access_context_by_slug(
                slug=org.slug, only_visible=True, user_id=self.user.id, include_resource_ids=True
            )

        assert count_organization_reads(by_id_queries) == 1
        assert count_organization_reads(by_slug_queries) == 1
        assert by_id is not None
        assert by_id.member is not None
        assert context is not None
        assert context.organization.id == org.id
        assert context.member is not None
        assert context.member.user_id == self.user.id
        assert "org:admin" in context.member.scopes
        assert context.member.scopes == by_id.member.scopes
        assert context.resource_ids is not None
        assert context.resource_ids.project_ids == [project.id]
        assert context.resource_ids.team_ids == [team.id]
        assert (
            organization_service.get_access_context_by_slug(slug="missing-org", only_visible=False)
            is None
        )

    def test_access_context_visibility(self) -> None:
        org = self.create_organization()
        context = organization_service.get_access_context_by_slug(
            slug=org.slug, only_visible=True, user_id=self.user.id
        )
        assert context is not None
        assert context.member is None
        assert context.resource_ids is None
        with assume_test_silo_mode_of(Organization):
            org.update(status=OrganizationStatus.PENDING_DELETION)
        assert (
            organization_service.get_access_context_by_slug(slug=org.slug, only_visible=True)
            is None
        )
        assert (
            organization_service.get_access_context_by_slug(slug=org.slug, only_visible=False)
            is not None
        )
        assert organization_service.get_access_context(organization_id=0) is None

    def test_project_summary_preserves_targeting_semantics(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org, platform="python")
        self.create_project(organization=org, platform="python")
        self.create_project(organization=org, platform=None)
        self.create_project(
            organization=org, platform="javascript", status=ObjectStatus.PENDING_DELETION
        )
        self.create_project(organization=self.create_organization(), platform="ruby")
        with assume_test_silo_mode_of(Project):
            project.flags.has_releases = True
            project.save()

        summary = organization_service.get_project_summary(organization_id=org.id)
        assert set(summary.platforms) == {"python", "javascript", None}
        assert summary.flags.has_releases
        assert not summary.flags.has_sessions


@all_silo_test
class CheckOrganizationTest(TestCase):
    def test_check_active_organization_by_slug(self) -> None:
        self.organization = self.create_organization(slug="test")
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=True)
            == self.organization.id
        )
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=False)
            == self.organization.id
        )

    def test_check_missing_organization_by_slug(self) -> None:
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=True) is None
        )
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=False) is None
        )

    def test_check_pending_deletion_organization_by_slug(self) -> None:
        self.organization = self.create_organization(slug="test")
        self.organization.status = OrganizationStatus.PENDING_DELETION
        with assume_test_silo_mode_of(Organization):
            self.organization.save()
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=True) is None
        )
        assert (
            organization_service.check_organization_by_slug(slug="test", only_visible=False)
            == self.organization.id
        )

    def test_check_active_organization_by_id(self) -> None:
        organization = self.create_organization(slug="test")
        assert (
            organization_service.check_organization_by_id(id=organization.id, only_visible=True)
            is True
        )
        assert (
            organization_service.check_organization_by_id(id=organization.id, only_visible=False)
            is True
        )

    def test_check_missing_organization_by_id(self) -> None:
        assert organization_service.check_organization_by_id(id=1234, only_visible=True) is False
        assert organization_service.check_organization_by_id(id=1234, only_visible=False) is False

    def test_check_pending_deletion_organization_by_id(self) -> None:
        self.organization = self.create_organization(slug="test")
        self.organization.status = OrganizationStatus.PENDING_DELETION
        with assume_test_silo_mode_of(Organization):
            self.organization.save()
        assert (
            organization_service.check_organization_by_id(
                id=self.organization.id, only_visible=True
            )
            is False
        )
        assert (
            organization_service.check_organization_by_id(
                id=self.organization.id, only_visible=False
            )
            is True
        )


@all_silo_test
class FindOrganizationIdByOptionValueTest(TestCase):
    KEY = "stripe_projects:account_id"

    def _set_option(self, organization: Organization, key: str, value: str) -> None:
        with assume_test_silo_mode_of(OrganizationOption):
            OrganizationOption.objects.set_value(organization=organization, key=key, value=value)

    def test_returns_org_id_when_exactly_one_match(self) -> None:
        org = self.create_organization(slug="org-a")
        self._set_option(org, self.KEY, "acct_xyz")

        assert (
            organization_service.find_organization_id_by_option_value(
                cell_name=settings.SENTRY_FALLBACK_CELL,
                key=self.KEY,
                value="acct_xyz",
            )
            == org.id
        )

    def test_returns_none_when_no_rows_match(self) -> None:
        org = self.create_organization(slug="org-a")
        self._set_option(org, self.KEY, "acct_other")

        assert (
            organization_service.find_organization_id_by_option_value(
                cell_name=settings.SENTRY_FALLBACK_CELL,
                key=self.KEY,
                value="acct_missing",
            )
            is None
        )

    def test_returns_lowest_org_id_when_multiple_match(self) -> None:
        # OrganizationOption.unique_together is (organization, key) — two
        # orgs CAN store the same value for the same key. Pin deterministic
        # result = lowest organization_id.
        org_a = self.create_organization(slug="org-a")
        org_b = self.create_organization(slug="org-b")
        self._set_option(org_a, self.KEY, "acct_collide")
        self._set_option(org_b, self.KEY, "acct_collide")

        result = organization_service.find_organization_id_by_option_value(
            cell_name=settings.SENTRY_FALLBACK_CELL,
            key=self.KEY,
            value="acct_collide",
        )
        assert result == min(org_a.id, org_b.id)

    def test_value_match_is_exact_no_case_folding(self) -> None:
        org = self.create_organization(slug="org-a")
        self._set_option(org, self.KEY, "acct_XYZ")

        assert (
            organization_service.find_organization_id_by_option_value(
                cell_name=settings.SENTRY_FALLBACK_CELL,
                key=self.KEY,
                value="acct_xyz",
            )
            is None
        )

    def test_value_match_does_not_strip_whitespace(self) -> None:
        org = self.create_organization(slug="org-a")
        self._set_option(org, self.KEY, "acct_xyz")

        assert (
            organization_service.find_organization_id_by_option_value(
                cell_name=settings.SENTRY_FALLBACK_CELL,
                key=self.KEY,
                value=" acct_xyz ",
            )
            is None
        )

    def test_returns_none_when_key_does_not_match(self) -> None:
        org = self.create_organization(slug="org-a")
        self._set_option(org, "some:other:key", "acct_xyz")

        assert (
            organization_service.find_organization_id_by_option_value(
                cell_name=settings.SENTRY_FALLBACK_CELL,
                key=self.KEY,
                value="acct_xyz",
            )
            is None
        )


def test_no_mapping_flag_silently_defaults() -> None:
    control_flag_names = set(RpcOrganizationMappingFlags.get_field_names())

    mapping_columns = {field.name for field in OrganizationMapping._meta.get_fields()}
    assert control_flag_names <= mapping_columns, (
        f"{sorted(control_flag_names - mapping_columns)} have no OrganizationMapping column. "
        "Declare them on RpcOrganizationFlags instead."
    )

    control_flags = serialize_organization_mapping_flags(
        OrganizationMapping(**{name: True for name in control_flag_names})
    )
    unpopulated = sorted(name for name in control_flag_names if not getattr(control_flags, name))
    assert not unpopulated, (
        f"serialize_organization_mapping_flags does not populate {unpopulated}, so they always "
        "fall back to their default when flags are built from control silo data."
    )
