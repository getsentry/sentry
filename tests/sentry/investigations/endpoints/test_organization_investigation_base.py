from __future__ import annotations

from uuid import uuid4

from django.urls import reverse

from sentry.investigations.models import (
    Investigation,
    InvestigationBlockExecutionStatus,
    InvestigationBlockExecutor,
)
from sentry.investigations.services import create_agentic_manual_investigation
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

    def test_closed_membership_organizations_cannot_list_or_create_investigations(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        with self.feature(FEATURE):
            assert self.client.get(self.collection_url).status_code == 404
            response = self.client.post(
                self.collection_url, data={"title": "Unavailable"}, format="json"
            )

        assert response.status_code == 404
        assert not Investigation.objects.filter(organization=self.organization).exists()

    def test_closed_membership_organizations_cannot_view_investigations(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Existing investigation"
        )
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": investigation.id,
            },
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

    def test_members_without_project_membership_can_read_and_cancel_orchestration(self) -> None:
        restricted_team = self.create_team(organization=self.organization)
        restricted_project = self.create_project(
            organization=self.organization, teams=[restricted_team]
        )
        investigation, _ = create_agentic_manual_investigation(
            organization=self.organization,
            user_id=self.user.id,
            title="Shared investigation",
            source={"type": "manual", "prompt": "Investigate latency"},
            project_ids=[restricted_project.id],
            filters={},
        )
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

        assert self.client.get(orchestration_url).status_code == 200
        response = self.client.post(
            command_url,
            data={
                "requestId": str(uuid4()),
                "expectedWorkflowVersion": 1,
                "command": {"type": "cancel"},
            },
            format="json",
        )
        assert response.status_code == 200

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

    def test_members_can_read_results_and_summaries_without_project_membership(self) -> None:
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
        assert response.status_code == 200
        assert response.data["blocks"][0]["output"]["rows"] == [[42]]
        assert response.data["summary"] == investigation.summary

        list_response = self.client.get(self.collection_url)
        assert list_response.status_code == 200
        listed = next(item for item in list_response.data if item["id"] == str(investigation.id))
        assert listed["summary"] == investigation.summary
        assert listed["summaryDescription"] == investigation.summary_description

    def test_non_member_cannot_list_or_create_investigations(self) -> None:
        self.login_as(self.create_user())

        assert self.client.get(self.collection_url).status_code == 403
        response = self.client.post(
            self.collection_url, data={"title": "Unauthorized"}, format="json"
        )
        assert response.status_code == 403
        assert not Investigation.objects.filter(organization=self.organization).exists()
