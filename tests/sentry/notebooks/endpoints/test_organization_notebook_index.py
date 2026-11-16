from __future__ import annotations

from datetime import timedelta
from typing import Any
from unittest import mock

import orjson
from django.urls import reverse
from django.utils import timezone
from drf_spectacular.settings import patched_settings
from openapi_schema_validator import OAS30Validator
from rest_framework.response import Response

import sentry.apidocs.extensions  # noqa: F401
from sentry.apidocs.hooks import CustomGenerator
from sentry.investigations.apidocs import PRIVATE_SCHEMA_SETTINGS
from sentry.investigations.models import InvestigationOrchestrationStatus
from sentry.models.organization import Organization
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.notebooks.endpoints.base import OrganizationNotebooksBaseEndpoint
from sentry.notebooks.models import Notebook, NotebookStatus
from sentry.notebooks.services.notebooks import NotebookSourceNotFound, NotebookValidationError
from sentry.notebooks.services.producer import PRODUCERS
from sentry.notebooks.services.producer_sources import (
    PRODUCER_SOURCE_TYPES,
    ProducerSourceType,
    ResolvedProducerSource,
    register_producer_source_type,
)
from sentry.seer.models.workflow import SeerWorkflowStrategy
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.notebook_producer_sources import (
    ExampleSourceValidator,
    register_example_source_type,
)
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token

FEATURE = "organizations:investigations"


def published_notebook_endpoints(endpoints: Any) -> Any:
    return [
        (path, path_regex, method, callback)
        for path, path_regex, method, callback in endpoints
        if issubclass(callback.view_class, OrganizationNotebooksBaseEndpoint)
        and callback.view_class.publish_status[method].is_published
    ]


@with_feature(FEATURE)
class OrganizationNotebookIndexTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.collection_url = reverse(
            "sentry-api-0-organization-notebooks",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def orchestration_url(self, investigation_id: str) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-orchestration",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "notebook_id": investigation_id,
            },
        )

    @mock.patch("sentry.notebooks.telemetry.sentry_sdk.metrics.count")
    def test_create_manual_and_list(self, metrics_count: mock.MagicMock) -> None:
        response = self.client.post(
            self.collection_url,
            data={
                "title": "Checkout follow-up",
                "projectIds": [self.project.id],
                "filters": {"environment": ["production"]},
            },
            format="json",
        )
        assert response.status_code == 201, response.data
        assert response.data["title"] == "Checkout follow-up"
        assert response.data["projectIds"] == [self.project.id]
        assert response.data["blocks"] == []
        metrics_count.assert_any_call(
            "investigations.started",
            1,
            attributes={"source_type": "manual", "template": "manual"},
        )

        response = self.client.get(self.collection_url)
        assert response.status_code == 200
        assert [item["title"] for item in response.data] == ["Checkout follow-up"]
        assert response.data[0]["blockCount"] == 0
        assert response.data[0]["isFavorited"] is False

    def test_create_requires_a_title(self) -> None:
        response = self.client.post(
            self.collection_url, data={"projectIds": [self.project.id]}, format="json"
        )

        assert response.status_code == 400
        assert response.data["title"] == ["This field is required."]

    def test_create_rejects_a_source(self) -> None:
        response = self.client.post(
            self.collection_url,
            data={"title": "With source", "source": {"type": "manual"}},
            format="json",
        )

        assert response.status_code == 400
        assert "source" in response.data
        assert not Notebook.objects.filter(title="With source").exists()

    def test_create_rejects_engine_source_types(self) -> None:
        register_example_source_type(self)
        for source_type in ("manual", "metric_open_period"):
            response = self.client.post(
                self.collection_url,
                data={"title": "With source", "source": {"type": source_type}},
                format="json",
            )

            assert response.status_code == 400
            assert response.data["source"] == {"type": "Unknown source type."}
        assert not Notebook.objects.filter(title="With source").exists()

    @mock.patch("sentry.notebooks.telemetry.sentry_sdk.metrics.count")
    def test_create_for_a_producer_source(self, metrics_count: mock.MagicMock) -> None:
        register_example_source_type(self)
        data = {
            "title": "Issue notebook",
            "source": {"type": "example_issue", "issueId": 7, "projectId": self.project.id},
        }

        created = self.client.post(self.collection_url, data=data, format="json")

        assert created.status_code == 201, created.data
        assert created.data["projectIds"] == [self.project.id]
        assert created.data["source"] == {
            "type": "example_issue",
            "ref": {"issueId": 7},
            "revision": 1,
        }
        notebook = Notebook.objects.get(id=created.data["id"])
        assert notebook.source_type == "example_issue"
        assert notebook.source_key == "example_issue:7"
        assert notebook.created_by_id == self.user.id
        assert metrics_count.call_count == 1

        again = self.client.post(self.collection_url, data=data, format="json")

        assert again.status_code == 200, again.data
        assert again.data["id"] == created.data["id"]
        assert metrics_count.call_count == 1

        notebook.update(status=NotebookStatus.ARCHIVED)
        revised = self.client.post(self.collection_url, data=data, format="json")

        assert revised.status_code == 201, revised.data
        assert revised.data["id"] != created.data["id"]
        assert revised.data["source"]["revision"] == 2

    def test_create_derives_source_fields_on_the_server(self) -> None:
        register_example_source_type(self)
        source = {"type": "example_issue", "issueId": 7, "projectId": self.project.id}
        for extra in (
            {"sourceType": "manual"},
            {"sourceKey": "example_issue:8"},
            {"sourceRevision": 3},
            {"projectIds": [self.project.id]},
        ):
            response = self.client.post(
                self.collection_url,
                data={"title": "Issue notebook", "source": source, **extra},
                format="json",
            )

            assert response.status_code == 400, extra
        assert not Notebook.objects.filter(title="Issue notebook").exists()

    def test_create_validates_the_source_with_its_type(self) -> None:
        register_example_source_type(self)
        response = self.client.post(
            self.collection_url,
            data={"title": "Issue notebook", "source": {"type": "example_issue", "issueId": 0}},
            format="json",
        )

        assert response.status_code == 400
        assert set(response.data["source"]) == {"issueId", "projectId"}

    def test_create_rejects_a_source_project_from_another_organization(self) -> None:
        register_example_source_type(self)
        other_project = self.create_project(organization=self.create_organization())
        response = self.client.post(
            self.collection_url,
            data={
                "title": "Issue notebook",
                "source": {"type": "example_issue", "issueId": 7, "projectId": other_project.id},
            },
            format="json",
        )

        assert response.status_code == 400
        assert response.data == {
            "source": ["One or more of the source's projects are inaccessible."]
        }
        assert not Notebook.objects.filter(title="Issue notebook").exists()

    def test_create_reports_source_resolution_errors_on_the_source(self) -> None:
        def resolve(organization: Organization, values: dict[str, Any]) -> ResolvedProducerSource:
            if values["issue_id"] == 1:
                raise NotebookSourceNotFound
            raise NotebookValidationError({"issueId": "The issue is resolved."})

        register_producer_source_type(
            ProducerSourceType(
                name="failing_issue",
                producer="example",
                validator=ExampleSourceValidator,
                resolve=resolve,
            )
        )
        self.addCleanup(PRODUCER_SOURCE_TYPES.pop, "failing_issue")

        def post(issue_id: int) -> Response:
            return self.client.post(
                self.collection_url,
                data={
                    "title": "Issue notebook",
                    "source": {
                        "type": "failing_issue",
                        "issueId": issue_id,
                        "projectId": self.project.id,
                    },
                },
                format="json",
            )

        missing = post(1)
        assert missing.status_code == 400
        assert missing.data == {"source": ["Source not found."]}
        invalid = post(2)
        assert invalid.status_code == 400
        assert invalid.data == {"source": {"issueId": "The issue is resolved."}}
        assert not Notebook.objects.filter(title="Issue notebook").exists()

    def test_list_includes_summary_when_projects_are_accessible(self) -> None:
        notebook = self.create_notebook(
            organization=self.organization,
            created_by=self.user,
            title="Checkout errors",
            summary="Errors crossed alert threshold",
            summary_description="Checkout errors increased.\nReview the latest release.",
        )
        self.create_notebook_project(notebook=notebook, project=self.project)

        response = self.client.get(self.collection_url)

        assert response.status_code == 200
        listed = next(item for item in response.data if item["id"] == str(notebook.id))
        assert listed["summary"] == "Errors crossed alert threshold"
        assert listed["summaryDescription"] == (
            "Checkout errors increased.\nReview the latest release."
        )

    def test_list_includes_orchestration_state_only_for_agentic_investigations(self) -> None:
        heartbeat = timezone.now()
        agentic = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Agentic"
        )
        self.create_investigation_orchestration_run(
            investigation=agentic,
            phase="judging",
            status="processing",
            notebook_revision=2,
            heartbeat_at=heartbeat,
        )
        manual = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Manual"
        )

        response = self.client.get(self.collection_url)

        assert response.status_code == 200
        listed = {item["id"]: item for item in response.data}
        assert listed[str(agentic.id)]["orchestration"] == {
            "phase": "judging",
            "status": "processing",
            "heartbeatAt": heartbeat,
            "notebookRevision": 2,
        }
        assert listed[str(manual.id)]["orchestration"] is None

    def test_regular_member_can_create_an_investigation(self) -> None:
        member_user = self.create_user()
        self.create_member(
            organization=self.organization, user=member_user, role="member", teams=[]
        )
        self.login_as(member_user)

        response = self.client.post(
            self.collection_url,
            data={"title": "Created by member", "projectIds": [self.project.id]},
            format="json",
        )

        assert response.status_code == 201, response.data
        assert response.data["createdBy"] == str(member_user.id)
        assert response.data["projectIds"] == [self.project.id]

    def test_manual_creation_rejects_inaccessible_project(self) -> None:
        other_organization = self.create_organization()
        other_project = self.create_project(organization=other_organization)
        response = self.client.post(
            self.collection_url,
            data={"title": "No access", "projectIds": [other_project.id]},
            format="json",
        )
        assert response.status_code == 400
        assert not Notebook.objects.filter(title="No access").exists()

    def test_source_lineage_lists_latest_and_keeps_historical_detail(self) -> None:
        lineage = {
            "organization": self.organization,
            "created_by": self.user,
            "source": {"type": "issue", "ref": {"groupId": "123"}},
            "source_type": "issue",
            "source_key": "issue:123",
        }
        first = self.create_notebook(
            title="First revision",
            source_revision=1,
            status=NotebookStatus.ARCHIVED,
            **lineage,
        )
        second = self.create_notebook(
            title="Second revision", source_revision=2, status=NotebookStatus.ACTIVE, **lineage
        )

        response = self.client.get(self.collection_url)
        assert [item["id"] for item in response.data] == [str(second.id)]

        first_url = reverse(
            "sentry-api-0-organization-notebook-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "notebook_id": first.id,
            },
        )
        assert self.client.get(first_url).status_code == 200

        second_url = reverse(
            "sentry-api-0-organization-notebook-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "notebook_id": second.id,
            },
        )
        assert (
            self.client.delete(
                second_url,
                data={"notebookVersion": second.version},
                format="json",
            ).status_code
            == 204
        )
        assert not Notebook.objects.filter(
            source_key="issue:123", status=NotebookStatus.ACTIVE
        ).exists()

        third = self.create_notebook(
            title="Third revision", source_revision=3, status=NotebookStatus.ACTIVE, **lineage
        )
        response = self.client.get(self.collection_url)
        assert [item["id"] for item in response.data] == [str(third.id)]

    def test_org_auth_token_can_list_investigations(self) -> None:
        self.create_notebook(organization=self.organization, created_by=self.user, title="Listed")
        token = generate_token(self.organization.slug, "")
        with assume_test_silo_mode(SiloMode.CONTROL):
            OrgAuthToken.objects.create(
                organization_id=self.organization.id,
                name="token",
                token_hashed=hash_token(token),
                token_last_characters=token[-4:],
                scope_list=["org:read"],
                date_last_used=None,
            )
            self.client.logout()

        response = self.client.get(self.collection_url, HTTP_AUTHORIZATION=f"Bearer {token}")

        assert response.status_code == 200, response.data
        assert [item["title"] for item in response.data] == ["Listed"]
        assert response.data[0]["isFavorited"] is False

    def link_to_automation_run(
        self,
        notebook: Notebook,
        strategy: SeerWorkflowStrategy = SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
    ) -> None:
        config = Factories.create_seer_workflow_config(self.organization, strategy=strategy)
        run = Factories.create_seer_workflow_run(self.organization, workflow_config=config)
        Factories.create_seer_workflow_output_link(
            Factories.create_seer_workflow_run_execution(run), notebook=notebook
        )

    def list_titles(self, **params: str | list[str]) -> list[str]:
        response = self.client.get(self.collection_url, params)
        assert response.status_code == 200, response.data
        return sorted(item["title"] for item in response.data)

    def test_list_filters_by_trigger(self) -> None:
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user)
        self.create_notebook(organization=self.organization, created_by=self.user, title="Mine")
        self.create_notebook(organization=self.organization, created_by=other_user, title="Theirs")
        breached = self.create_notebook(organization=self.organization, title="Breached")
        self.link_to_automation_run(breached)
        triage = self.create_notebook(organization=self.organization, title="Triage")
        self.link_to_automation_run(triage, SeerWorkflowStrategy.AGENTIC_TRIAGE_V2)
        # An automation reusing an investigation a user started doesn't make it automation-triggered.
        reused = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Reused"
        )
        self.link_to_automation_run(reused)
        self.create_notebook(organization=self.organization, title="Unattributed")

        assert self.list_titles(trigger="me") == ["Mine", "Reused"]
        assert self.list_titles(trigger="user") == ["Mine", "Reused", "Theirs"]
        assert self.list_titles(trigger="automation") == ["Breached", "Triage"]
        assert self.list_titles(strategy="breached_metric_investigation") == ["Breached"]
        assert self.list_titles(trigger="automation", strategy="agentic_triage_v2") == ["Triage"]
        assert len(self.list_titles()) == 6

    def test_automation_trigger_uses_the_first_run_in_this_organization(self) -> None:
        notebook = self.create_notebook(organization=self.organization, title="Breached")
        other_organization = self.create_organization()
        other_config = Factories.create_seer_workflow_config(
            other_organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )
        Factories.create_seer_workflow_output_link(
            Factories.create_seer_workflow_run_execution(
                Factories.create_seer_workflow_run(other_organization, workflow_config=other_config)
            ),
            notebook=notebook,
        )
        self.link_to_automation_run(notebook)
        self.link_to_automation_run(notebook, SeerWorkflowStrategy.AGENTIC_TRIAGE_V2)

        assert self.list_titles(strategy="breached_metric_investigation") == ["Breached"]
        assert self.list_titles(strategy="agentic_triage_v2") == []

    def test_list_filters_by_run_status(self) -> None:
        for title, run_status in (
            ("Running", "processing"),
            ("Waiting", "awaiting_input"),
            ("Done", "completed"),
        ):
            notebook = self.create_notebook(
                organization=self.organization, created_by=self.user, title=title
            )
            self.create_investigation_orchestration_run(investigation=notebook, status=run_status)
        self.create_notebook(organization=self.organization, created_by=self.user, title="Manual")

        assert self.list_titles(runStatus="completed") == ["Done"]
        assert self.list_titles(runStatus=["processing", "awaiting_input"]) == [
            "Running",
            "Waiting",
        ]

    def test_list_accepts_every_engine_run_status(self) -> None:
        for run_status in InvestigationOrchestrationStatus.values:
            response = self.client.get(self.collection_url, {"runStatus": run_status})
            assert response.status_code == 200, run_status

    def test_list_rejects_an_unknown_run_status(self) -> None:
        response = self.client.get(self.collection_url, {"runStatus": ["completed", "unknown"]})

        assert response.status_code == 400
        assert response.data == {"detail": "Unknown run status."}

    def test_run_status_filter_skips_source_types_without_a_producer(self) -> None:
        for title, source_fields in (
            ("Manual", {}),
            (
                "Metric",
                {
                    "source_type": "metric_open_period",
                    "source_key": "metric_open_period:1:1",
                    "source_revision": 1,
                },
            ),
            (
                "Unregistered",
                {"source_type": "issue", "source_key": "issue:1", "source_revision": 1},
            ),
        ):
            notebook = self.create_notebook(
                organization=self.organization,
                created_by=self.user,
                title=title,
                **source_fields,
            )
            self.create_investigation_orchestration_run(investigation=notebook, status="completed")

        assert self.list_titles(runStatus="completed") == ["Manual", "Metric"]

    def test_no_run_status_is_known_without_producers(self) -> None:
        with mock.patch.dict(PRODUCERS, clear=True):
            response = self.client.get(self.collection_url, {"runStatus": "completed"})

        assert response.status_code == 400
        assert response.data == {"detail": "Unknown run status."}

    def test_list_sorts_by_creation_or_last_update(self) -> None:
        older = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Older"
        )
        newer = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Newer"
        )
        now = timezone.now()
        Notebook.objects.filter(id=older.id).update(
            date_added=now - timedelta(days=2), date_updated=now
        )
        Notebook.objects.filter(id=newer.id).update(
            date_added=now - timedelta(days=1), date_updated=now - timedelta(hours=1)
        )

        for sort, expected in (
            (None, ["Older", "Newer"]),
            ("dateUpdated", ["Older", "Newer"]),
            ("dateCreated", ["Newer", "Older"]),
        ):
            response = self.client.get(self.collection_url, {"sort": sort} if sort else {})
            assert response.status_code == 200, response.data
            assert [item["title"] for item in response.data] == expected

    def test_list_rejects_invalid_filters(self) -> None:
        for params in (
            {"trigger": "someone"},
            {"strategy": "unknown"},
            {"trigger": "me", "strategy": "breached_metric_investigation"},
            {"runStatus": "unknown"},
            {"sort": "title"},
        ):
            response = self.client.get(self.collection_url, params)
            assert response.status_code == 400, params

    def test_trigger_me_requires_a_user(self) -> None:
        token = generate_token(self.organization.slug, "")
        with assume_test_silo_mode(SiloMode.CONTROL):
            OrgAuthToken.objects.create(
                organization_id=self.organization.id,
                name="token",
                token_hashed=hash_token(token),
                token_last_characters=token[-4:],
                scope_list=["org:read"],
                date_last_used=None,
            )
            self.client.logout()

        response = self.client.get(
            self.collection_url, {"trigger": "me"}, HTTP_AUTHORIZATION=f"Bearer {token}"
        )

        assert response.status_code == 400, response.data

    def test_schemas_match_frontend_responses(self) -> None:
        with patched_settings(PRIVATE_SCHEMA_SETTINGS):
            private_schema = CustomGenerator().get_schema(public=True)
        with patched_settings(
            {
                **PRIVATE_SCHEMA_SETTINGS,
                "PREPROCESSING_HOOKS": [f"{__name__}.published_notebook_endpoints"],
            }
        ):
            public_schema = CustomGenerator().get_schema(public=True)
        base = "/api/0/organizations/{organization_id_or_slug}/notebooks/"
        detail_path = base + "{notebook_id}/"
        orchestration_path = (
            "/api/0/organizations/{organization_id_or_slug}/investigations/"
            "{notebook_id}/orchestration/"
        )

        def validate_response(response: Response, method: str, path: str) -> None:
            assert 200 <= response.status_code < 300, response.data
            schema = (
                private_schema if method in private_schema["paths"].get(path, {}) else public_schema
            )
            response_schema = schema["paths"][path][method]["responses"][str(response.status_code)][
                "content"
            ]["application/json"]["schema"]
            OAS30Validator({**response_schema, "components": schema["components"]}).validate(
                orjson.loads(response.content)
            )

        created = self.client.post(
            self.collection_url,
            data={"title": "Checkout latency", "projectIds": [self.project.id]},
            format="json",
        )
        validate_response(created, "post", base)
        validate_response(self.client.get(self.collection_url), "get", base)
        detail_url = f"{self.collection_url}{created.data['id']}/"
        block = self.client.post(
            detail_url + "blocks/",
            data={
                "notebookVersion": created.data["version"],
                "kind": "text",
                "content": "Initial observations",
            },
            format="json",
        )
        validate_response(block, "post", detail_path + "blocks/")
        detail = self.client.get(detail_url)
        validate_response(detail, "get", detail_path)
        comment = self.client.post(
            detail_url + "comments/",
            data={"body": "Latency rose after deployment.", "blockId": int(block.data["id"])},
            format="json",
        )
        validate_response(comment, "post", detail_path + "comments/")
        validate_response(
            self.client.get(detail_url + "comments/"), "get", detail_path + "comments/"
        )
        validate_response(
            self.client.get(detail_url + "comment-counts/"), "get", detail_path + "comment-counts/"
        )
        validate_response(
            self.client.put(detail_url + "presence/"), "put", detail_path + "presence/"
        )
        validate_response(
            self.client.get(detail_url + "title-generation/"),
            "get",
            detail_path + "title-generation/",
        )

        agentic = self.client.post(
            reverse(
                "sentry-api-0-organization-investigations",
                kwargs={"organization_id_or_slug": self.organization.slug},
            ),
            data={"source": {"type": "manual"}},
            format="json",
        )
        validate_response(
            agentic, "post", "/api/0/organizations/{organization_id_or_slug}/investigations/"
        )
        orchestration = self.client.get(self.orchestration_url(agentic.data["id"]))
        validate_response(orchestration, "get", orchestration_path)
