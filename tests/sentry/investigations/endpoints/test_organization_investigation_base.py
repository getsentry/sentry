from __future__ import annotations

from uuid import uuid4

from django.urls import reverse

from sentry.investigations.models import (
    Investigation,
    InvestigationBlockExecutionStatus,
    InvestigationBlockExecutor,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode

FEATURE = "organizations:investigations"


class OrganizationInvestigationBaseTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.collection_url = reverse(
            "sentry-api-0-organization-investigations",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_closed_membership_organizations_are_not_supported(self) -> None:
        """
        Investigations are organization-visible with no per-investigation access
        control, so the initial pass is limited to open-membership orgs.
        """
        self.login_as(self.user)
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        url = reverse(
            "sentry-api-0-organization-investigations",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        with self.feature(FEATURE):
            assert self.client.get(url).status_code == 404

    def test_feature_is_required(self) -> None:
        self.login_as(self.user)
        response = self.client.get(
            reverse(
                "sentry-api-0-organization-investigations",
                kwargs={"organization_id_or_slug": self.organization.slug},
            )
        )
        assert response.status_code == 404

    def test_feature_is_required_for_orchestration(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Agentic"
        )
        self.create_investigation_orchestration_run(investigation=investigation)
        url = reverse(
            "sentry-api-0-organization-investigation-orchestration",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        assert self.client.get(url).status_code == 404


@with_feature(FEATURE)
class OrganizationInvestigationsEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.collection_url = reverse(
            "sentry-api-0-organization-investigations",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_unauthenticated_request_is_rejected(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.client.logout()
        response = self.client.get(self.collection_url)
        assert response.status_code in {401, 403}

    def test_orchestration_routes_reject_an_investigation_from_another_organization(self) -> None:
        other_organization = self.create_organization()
        investigation = self.create_investigation(
            organization=other_organization, created_by=self.user, title="Other tenant"
        )
        self.create_investigation_orchestration_run(investigation=investigation)
        url = reverse(
            "sentry-api-0-organization-investigation-orchestration",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        assert self.client.get(url).status_code == 404

    def test_orchestration_routes_require_every_selected_project(self) -> None:
        restricted_team = self.create_team(organization=self.organization)
        restricted_project = self.create_project(
            organization=self.organization, teams=[restricted_team]
        )
        investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Restricted"
        )
        self.create_investigation_project(investigation=investigation, project=restricted_project)
        self.create_investigation_orchestration_run(investigation=investigation)
        viewer = self.create_user()
        self.create_member(organization=self.organization, user=viewer, role="member", teams=[])
        self.login_as(viewer)
        orchestration_url = reverse(
            "sentry-api-0-organization-investigation-orchestration",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        command_url = reverse(
            "sentry-api-0-organization-investigation-orchestration-commands",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        assert self.client.get(orchestration_url).status_code == 403
        response = self.client.post(
            command_url,
            data={
                "requestId": str(uuid4()),
                "expectedWorkflowVersion": 1,
                "command": {"type": "cancel"},
            },
            format="json",
        )
        assert response.status_code == 403

    def test_empty_project_scope_does_not_require_every_organization_project(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Unscoped"
        )
        restricted_team = self.create_team(organization=self.organization)
        self.create_project(organization=self.organization, teams=[restricted_team])
        viewer = self.create_user()
        self.create_member(organization=self.organization, user=viewer, role="member")
        self.login_as(viewer)
        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        response = self.client.get(detail_url)

        assert response.status_code == 200

    def test_detail_requires_result_project_access_but_list_remains_visible(self) -> None:
        create_response = self.client.post(
            self.collection_url, data={"title": "Output"}, format="json"
        )
        investigation = Investigation.objects.get(id=create_response.data["id"])
        investigation.update(
            summary="Errors crossed alert threshold",
            summary_description="Restricted evidence.\nRestricted remediation.",
        )
        block = self.create_investigation_block(
            investigation=investigation,
            position=0,
            kind="query",
            content="count errors",
            display={"type": "table"},
        )
        execution = self.create_investigation_block_execution(
            block=block,
            executor=InvestigationBlockExecutor.MANUAL,
            status=InvestigationBlockExecutionStatus.COMPLETED,
            block_version=1,
            input_fingerprint="a" * 64,
            result={"columns": ["count"], "rows": [[42]]},
        )
        block.current_execution = execution
        block.result_execution = execution
        block.save(update_fields=["current_execution", "result_execution"])

        detail_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )
        response = self.client.get(detail_url)
        assert response.data["blocks"][0]["outputStatus"] == "available"
        assert response.data["blocks"][0]["output"]["rows"] == [[42]]

        viewer = self.create_user()
        self.create_member(organization=self.organization, user=viewer, role="member")
        restricted_team = self.create_team(organization=self.organization)
        inaccessible_project = self.create_project(
            organization=self.organization, teams=[restricted_team]
        )
        self.create_investigation_block_execution_project(
            execution=execution, project=inaccessible_project
        )
        self.login_as(viewer)
        response = self.client.get(detail_url)
        assert response.status_code == 403

        list_response = self.client.get(self.collection_url)
        assert list_response.status_code == 200
        listed = next(item for item in list_response.data if item["id"] == str(investigation.id))
        assert listed["summary"] is None
        assert listed["summaryDescription"] is None

    def test_project_query_param_cannot_widen_the_access_check(self) -> None:
        team = self.create_team(organization=self.organization)
        restricted = self.create_project(organization=self.organization, teams=[team])
        investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Restricted"
        )
        block = self.create_investigation_block(
            investigation=investigation, position=0, kind="query"
        )
        execution = self.create_investigation_block_execution(
            block=block,
            executor="manual",
            block_version=1,
            input_fingerprint="f" * 64,
            status=InvestigationBlockExecutionStatus.COMPLETED,
            result={"schemaVersion": 1},
        )
        self.create_investigation_block_execution_project(execution=execution, project=restricted)
        block.update(current_execution=execution, result_execution=execution)

        viewer = self.create_user()
        self.create_member(organization=self.organization, user=viewer, role="member", teams=[])
        self.login_as(viewer)
        url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
        )

        assert self.client.get(url).status_code == 403
        assert self.client.get(f"{url}?project=-1").status_code == 403
        assert self.client.get(f"{url}?project={restricted.id}").status_code == 403
