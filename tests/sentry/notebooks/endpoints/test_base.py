from __future__ import annotations

from typing import Any

from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from sentry.investigations.models import InvestigationOrchestrationCommand
from sentry.notebooks.models import Notebook, NotebookBlock, NotebookProject, NotebookStatus
from sentry.seer import agent_token
from sentry.tasks.seer.investigation import _dispatch_viewer_scope
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.link_header import parse_link_header
from sentry.testutils.helpers.notebook_producer_sources import register_example_source_type
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context

SECRET = "notebook-writer-test-secret-thirty-two-bytes"


@override_settings(SEER_API_SHARED_SECRET=SECRET)
@with_feature(
    {
        "organizations:investigations": True,
        "organizations:service-accounts": True,
        agent_token.FEATURE_FLAG: True,
    }
)
class NotebookWriterTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.notebook = self.create_notebook(
            organization=self.organization, created_by=self.user, title="Writers"
        )

    def url(self, name: str, **kwargs: Any) -> str:
        return reverse(name, kwargs={"organization_id_or_slug": self.organization.slug, **kwargs})

    def agent_client(self) -> APIClient:
        token, _ = agent_token.encode_agent_token(
            user_id=self.user.id,
            organization_id=self.organization.id,
            scopes=["org:read"],
            session_id="notebook-writer",
        )
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client

    def service_account_client(self, project_ids: list[int] | None = None) -> tuple[APIClient, int]:
        """An account linked to `project_ids`, or to every project when it's None."""
        service_account = self.create_service_account(
            organization=self.organization,
            scope_list=["org:read"],
            project_ids=project_ids or (),
            all_projects=project_ids is None,
        )
        viewer_context = encode_viewer_context(
            ViewerContext(
                actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=service_account.id),
                organization_id=self.organization.id,
            ),
            key=SECRET,
        )
        client = APIClient()
        client.credentials(HTTP_X_VIEWER_CONTEXT=viewer_context)
        return client, service_account.id

    def org_token_client(self) -> APIClient:
        token = generate_token(self.organization.slug, "")
        self.create_org_auth_token(
            organization_id=self.organization.id,
            name="notebook token",
            token_hashed=hash_token(token),
            token_last_characters=token[-4:],
            scope_list=["org:read"],
        )
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client

    def sentry_app_client(self) -> APIClient:
        integration = self.create_internal_integration(
            organization=self.organization, scopes=["org:read"]
        )
        token = self.create_internal_integration_token(
            user=self.user, internal_integration=integration
        )
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.token}")
        return client

    def write_everything(self, client: APIClient) -> list[int]:
        """Run each notebook and block mutation and return the status codes."""
        created = client.post(
            self.url("sentry-api-0-organization-notebooks"), {"title": "New"}, format="json"
        )
        block = client.post(
            self.url("sentry-api-0-organization-notebook-blocks", notebook_id=self.notebook.id),
            {"notebookVersion": self.notebook.version, "kind": "text", "content": "a"},
            format="json",
        )
        if block.status_code != 201:
            return [created.status_code, block.status_code]
        block_url = self.url(
            "sentry-api-0-organization-notebook-block-details",
            notebook_id=self.notebook.id,
            block_id=block.data["id"],
        )
        updated = client.put(
            block_url,
            {"notebookVersion": 2, "version": 1, "content": "b"},
            format="json",
        )
        ordered = client.put(
            self.url(
                "sentry-api-0-organization-notebook-block-order", notebook_id=self.notebook.id
            ),
            {"notebookVersion": 3, "blockIds": [int(block.data["id"])]},
            format="json",
        )
        deleted = client.delete(block_url, {"notebookVersion": 4, "version": 2}, format="json")
        return [
            created.status_code,
            block.status_code,
            updated.status_code,
            ordered.status_code,
            deleted.status_code,
        ]

    def test_agent_token_writes_as_its_user(self) -> None:
        assert self.write_everything(self.agent_client()) == [201, 201, 200, 200, 204]
        assert Notebook.objects.get(title="New").created_by_id == self.user.id
        block = NotebookBlock.objects.get(notebook=self.notebook)
        assert block.created_by_id == self.user.id
        assert block.last_edited_by_id == self.user.id

    def test_service_account_writes_without_a_user(self) -> None:
        client, service_account_id = self.service_account_client()
        assert self.write_everything(client) == [201, 201, 200, 200, 204]
        notebook = Notebook.objects.get(title="New")
        assert notebook.created_by_id is None
        assert notebook.created_by_service_account_id == service_account_id
        block = NotebookBlock.objects.get(notebook=self.notebook)
        assert block.created_by_id is None
        assert block.last_edited_by_id is None
        assert block.content == "b"

    def test_org_auth_token_cannot_write(self) -> None:
        assert self.write_everything(self.org_token_client()) == [403, 403]
        assert not Notebook.objects.filter(title="New").exists()
        assert not NotebookBlock.objects.filter(notebook=self.notebook).exists()

    def test_sentry_app_cannot_write(self) -> None:
        assert self.write_everything(self.sentry_app_client()) == [403, 403]
        assert not Notebook.objects.filter(title="New").exists()
        assert not NotebookBlock.objects.filter(notebook=self.notebook).exists()

    def test_rejected_principals_cannot_change_existing_blocks(self) -> None:
        block = self.create_notebook_block(notebook=self.notebook, position=0, kind="text")
        block_url = self.url(
            "sentry-api-0-organization-notebook-block-details",
            notebook_id=self.notebook.id,
            block_id=block.id,
        )
        order_url = self.url(
            "sentry-api-0-organization-notebook-block-order", notebook_id=self.notebook.id
        )
        for client in (self.org_token_client(), self.sentry_app_client()):
            assert (
                client.put(
                    block_url,
                    {"notebookVersion": 1, "version": 1, "content": "no"},
                    format="json",
                ).status_code
                == 403
            )
            assert (
                client.put(
                    order_url, {"notebookVersion": 1, "blockIds": [block.id]}, format="json"
                ).status_code
                == 403
            )
            assert (
                client.delete(
                    block_url, {"notebookVersion": 1, "version": 1}, format="json"
                ).status_code
                == 403
            )
        block.refresh_from_db()
        assert block.content == ""
        assert block.deleted_at is None

    def change_notebook(self, client: APIClient) -> list[int]:
        """Rename then archive the notebook and return the status codes."""
        url = self.url("sentry-api-0-organization-notebook-details", notebook_id=self.notebook.id)
        renamed = client.put(url, {"notebookVersion": 1, "title": "Renamed"}, format="json")
        archived = client.delete(url, {"notebookVersion": 2}, format="json")
        return [renamed.status_code, archived.status_code]

    def test_users_agents_and_service_accounts_change_notebooks(self) -> None:
        self.login_as(self.user)
        clients = [self.client, self.agent_client(), self.service_account_client()[0]]
        for client in clients:
            self.notebook = self.create_notebook(
                organization=self.organization, created_by=self.user, title="Writers"
            )
            assert self.change_notebook(client) == [200, 204]
            self.notebook.refresh_from_db()
            assert self.notebook.title == "Renamed"
            assert self.notebook.status == NotebookStatus.ARCHIVED

    def test_rejected_principals_cannot_change_notebooks(self) -> None:
        for client in (self.org_token_client(), self.sentry_app_client()):
            assert self.change_notebook(client) == [403, 403]
        self.notebook.refresh_from_db()
        assert self.notebook.title == "Writers"
        assert self.notebook.status == NotebookStatus.ACTIVE

    def test_service_account_archives_a_running_investigation(self) -> None:
        run = self.create_investigation_orchestration_run(
            investigation=self.notebook,
            projection={"workflowVersion": 1, "report": {"revision": 0, "status": "running"}},
        )
        client, service_account_id = self.service_account_client()
        url = self.url("sentry-api-0-organization-notebook-details", notebook_id=self.notebook.id)

        with self.captureOnCommitCallbacks(execute=False):
            response = client.delete(url, {"notebookVersion": 1}, format="json")

        assert response.status_code == 204, response.data
        self.notebook.refresh_from_db()
        assert self.notebook.status == NotebookStatus.ARCHIVED
        command = InvestigationOrchestrationCommand.objects.get(orchestration_run=run)
        assert command.type == "cancel"
        assert command.actor_id is None
        assert command.requested_by_service_account_id == service_account_id
        # Dispatch checks the account again; the cancel only reaches Seer if this passes.
        with _dispatch_viewer_scope(self.notebook, command=command):
            pass

    def test_project_limited_service_account_cannot_change_other_notebooks(self) -> None:
        other = self.create_project(organization=self.organization)
        self.create_notebook_project(self.notebook, other)
        block = self.create_notebook_block(notebook=self.notebook, position=0, kind="text")
        client, _ = self.service_account_client(project_ids=[self.project.id])
        details_url = self.url(
            "sentry-api-0-organization-notebook-details", notebook_id=self.notebook.id
        )
        block_url = self.url(
            "sentry-api-0-organization-notebook-block-details",
            notebook_id=self.notebook.id,
            block_id=block.id,
        )

        responses = [
            client.put(details_url, {"notebookVersion": 1, "title": "No"}, format="json"),
            client.put(
                details_url,
                {"notebookVersion": 1, "projectIds": [self.project.id]},
                format="json",
            ),
            client.delete(details_url, {"notebookVersion": 1}, format="json"),
            client.post(
                self.url("sentry-api-0-organization-notebook-blocks", notebook_id=self.notebook.id),
                {"notebookVersion": 1, "kind": "text", "content": "no"},
                format="json",
            ),
            client.put(
                block_url, {"notebookVersion": 1, "version": 1, "content": "no"}, format="json"
            ),
            client.put(
                self.url(
                    "sentry-api-0-organization-notebook-block-order", notebook_id=self.notebook.id
                ),
                {"notebookVersion": 1, "blockIds": [block.id]},
                format="json",
            ),
            client.delete(block_url, {"notebookVersion": 1, "version": 1}, format="json"),
        ]

        assert [response.status_code for response in responses] == [403] * 7
        self.notebook.refresh_from_db()
        assert self.notebook.title == "Writers"
        assert self.notebook.status == NotebookStatus.ACTIVE
        assert list(self.notebook.projects.values_list("id", flat=True)) == [other.id]
        block.refresh_from_db()
        assert block.content == ""
        assert block.deleted_at is None

    def test_project_limited_service_account_creates_a_source_notebook(self) -> None:
        register_example_source_type(self)
        client, _ = self.service_account_client(project_ids=[self.project.id])

        response = client.post(
            self.url("sentry-api-0-organization-notebooks"),
            {
                "title": "Issue notebook",
                "source": {"type": "example_issue", "issueId": 7, "projectId": self.project.id},
            },
            format="json",
        )

        assert response.status_code == 201, response.data
        assert response.data["projectIds"] == [self.project.id]

    def test_service_account_needs_every_project_for_an_unscoped_notebook(self) -> None:
        self.create_notebook_project(self.notebook, self.project)
        client, _ = self.service_account_client(project_ids=[self.project.id])

        created = client.post(
            self.url("sentry-api-0-organization-notebooks"), {"title": "Unscoped"}, format="json"
        )
        cleared = client.put(
            self.url("sentry-api-0-organization-notebook-details", notebook_id=self.notebook.id),
            {"notebookVersion": 1, "projectIds": []},
            format="json",
        )

        assert [created.status_code, cleared.status_code] == [403, 403]
        assert not Notebook.objects.filter(title="Unscoped").exists()
        assert list(self.notebook.projects.values_list("id", flat=True)) == [self.project.id]

    def test_service_account_only_attaches_its_own_projects(self) -> None:
        other = self.create_project(organization=self.organization)
        self.create_notebook_project(self.notebook, self.project)
        client, _ = self.service_account_client(project_ids=[self.project.id])
        index_url = self.url("sentry-api-0-organization-notebooks")
        details_url = self.url(
            "sentry-api-0-organization-notebook-details", notebook_id=self.notebook.id
        )

        assert (
            client.post(
                index_url, {"title": "Other", "projectIds": [other.id]}, format="json"
            ).status_code
            == 403
        )
        assert (
            client.put(
                details_url, {"notebookVersion": 1, "projectIds": [other.id]}, format="json"
            ).status_code
            == 403
        )
        assert not Notebook.objects.filter(title="Other").exists()
        assert list(self.notebook.projects.values_list("id", flat=True)) == [self.project.id]

        created = client.post(
            index_url, {"title": "Mine", "projectIds": [self.project.id]}, format="json"
        )
        assert created.status_code == 201, created.data
        updated = client.put(
            details_url, {"notebookVersion": 1, "projectIds": [self.project.id]}, format="json"
        )
        assert updated.status_code == 200, updated.data
        assert list(
            NotebookProject.objects.filter(notebook=self.notebook).values_list(
                "project_id", flat=True
            )
        ) == [self.project.id]

    def test_monitor_reads_require_original_project_access(self) -> None:
        other = self.create_project(organization=self.organization)
        notebook = self.create_notebook(
            self.organization,
            title="Protected monitor investigation",
            source_type="metric_open_period",
            source_key="metric_open_period:1:1",
            source_revision=1,
            source={"type": "metric_open_period", "snapshot": {"project": {"id": str(other.id)}}},
        )
        block = self.create_notebook_block(
            notebook=notebook, position=0, kind="text", content="Private findings"
        )
        execution = self.create_notebook_block_execution(block=block, block_version=block.version)
        self.create_investigation_orchestration_run(
            investigation=notebook, projection={"report": {}}
        )
        # Editable selection cannot substitute for the original source project.
        self.create_notebook_project(notebook, self.project)
        client, _ = self.service_account_client(project_ids=[self.project.id])
        routes = [
            ("sentry-api-0-organization-notebook-details", {}),
            (
                "sentry-api-0-organization-notebook-block-execution-details",
                {"block_id": block.id, "execution_id": execution.id},
            ),
            ("sentry-api-0-organization-notebook-comments", {}),
            ("sentry-api-0-organization-notebook-comment-counts", {}),
            ("sentry-api-0-organization-investigation-orchestration", {}),
        ]
        for route, params in routes:
            url = self.url(route, notebook_id=notebook.id, **params)
            denied = client.get(url)
            assert denied.status_code == 404, denied.data
            assert "Protected monitor investigation" not in str(denied.data)
            assert "Private findings" not in str(denied.data)
            assert self.agent_client().get(url).status_code == 200
        presence_url = self.url(
            "sentry-api-0-organization-notebook-presence", notebook_id=notebook.id
        )
        self.login_as(self.user)
        assert self.client.put(presence_url).status_code == 200
        notebook.update(source={})
        assert self.client.put(presence_url).status_code == 404

    def test_monitor_collection_filters_before_pagination(self) -> None:
        visible = self.create_notebook(
            self.organization,
            source_type="metric_open_period",
            source_key="metric_open_period:1:1",
            source_revision=1,
            source={
                "type": "metric_open_period",
                "snapshot": {"project": {"id": str(self.project.id)}},
            },
        )
        hidden = self.create_notebook(
            self.organization,
            source_type="metric_open_period",
            source_key="metric_open_period:2:2",
            source_revision=1,
            source={
                "type": "metric_open_period",
                "snapshot": {"project": {"id": str(self.create_project().id)}},
            },
        )
        client, _ = self.service_account_client(project_ids=[self.project.id])
        url = self.url("sentry-api-0-organization-notebooks")
        page = client.get(url, {"per_page": 1})
        assert page.status_code == 200
        assert [item["id"] for item in page.data] == [str(visible.id)]
        next_url = next(
            url for url, attrs in parse_link_header(page["Link"]).items() if attrs["rel"] == "next"
        )
        following = client.get(next_url)
        assert [item["id"] for item in following.data] == [str(self.notebook.id)]
        assert str(hidden.id) not in [item["id"] for item in following.data]
        assert 'rel="next"; results="false"' in following["Link"]
