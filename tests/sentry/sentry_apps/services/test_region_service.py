import orjson
import responses
from django.utils.http import urlencode
from responses.matchers import query_string_matcher

from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.sentry_apps.models.servicehook import ServiceHook, ServiceHookProject
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.services.region import sentry_app_region_service
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode_of
from sentry.users.services.user.serial import serialize_rpc_user


@all_silo_test
class TestSentryAppRegionService(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.group = self.create_group(project=self.project)

        self.sentry_app = self.create_sentry_app(
            name="Testin", organization=self.org, webhook_url="https://example.com"
        )

        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.user
        )
        self.rpc_installation = app_service.get_many(filter=dict(uuids=[self.install.uuid]))[0]

    @responses.activate
    def test_get_select_options(self) -> None:
        options = [{"label": "Project Name", "value": "1234"}]
        dependent_data = orjson.dumps({"org_id": "A"}).decode()
        qs = urlencode(
            {
                "projectSlug": self.project.slug,
                "installationId": self.install.uuid,
                "query": "proj",
                "dependentData": dependent_data,
            }
        )
        responses.add(
            method=responses.GET,
            url="https://example.com/get-projects",
            match=[query_string_matcher(qs)],
            json=options,
            status=200,
            content_type="application/json",
        )

        result = sentry_app_region_service.get_select_options(
            organization_id=self.org.id,
            installation=self.rpc_installation,
            uri="/get-projects",
            project_id=self.project.id,
            query="proj",
            dependent_data=dependent_data,
        )

        assert result.error is None
        assert result.choices == [["1234", "Project Name"]]

    @responses.activate
    def test_get_select_options_error(self) -> None:
        responses.add(
            method=responses.GET,
            url=f"https://example.com/get-projects?installationId={self.install.uuid}",
            status=500,
            content_type="application/json",
        )

        result = sentry_app_region_service.get_select_options(
            organization_id=self.org.id,
            installation=self.rpc_installation,
            uri="/get-projects",
        )
        assert result.error is not None
        assert result.error.message.startswith(
            "Something went wrong while getting options for Select FormField"
        )
        assert result.error.webhook_context["error_type"] == "select_options.requested.bad_response"
        assert result.error.status_code == 500

    @responses.activate
    def test_create_issue_link(self) -> None:
        responses.add(
            method=responses.POST,
            url="https://example.com/link-issue",
            json={
                "project": "Projectname",
                "webUrl": "https://example.com/project/issue-id",
                "identifier": "issue-1",
            },
            status=200,
            content_type="application/json",
        )

        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert PlatformExternalIssue.objects.filter(group_id=self.group.id).exists() is False
        result = sentry_app_region_service.create_issue_link(
            organization_id=self.org.id,
            installation=self.rpc_installation,
            group_id=self.group.id,
            action="create",
            fields={"title": "An Issue"},
            uri="/link-issue",
            user=serialize_rpc_user(self.user),
        )
        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert PlatformExternalIssue.objects.filter(group_id=self.group.id).exists()

        assert result.error is None
        assert result.external_issue is not None
        assert result.external_issue.issue_id == str(self.group.id)
        assert result.external_issue.web_url == "https://example.com/project/issue-id"
        assert result.external_issue.display_name == "Projectname#issue-1"

    @responses.activate
    def test_create_issue_link_error(self) -> None:
        responses.add(
            method=responses.POST,
            url="https://example.com/link-issue",
            json={"error": "something went wrong"},
            status=500,
            content_type="application/json",
        )

        result = sentry_app_region_service.create_issue_link(
            organization_id=self.org.id,
            installation=self.rpc_installation,
            group_id=self.group.id,
            action="create",
            fields={},
            uri="/link-issue",
            user=serialize_rpc_user(self.user),
        )

        assert result.error is not None
        assert result.external_issue is None
        assert result.error.webhook_context["error_type"] == "external_issue.linked.bad_response"
        assert result.error.status_code == 500

    def test_create_external_issue(self) -> None:
        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert PlatformExternalIssue.objects.filter(group_id=self.group.id).exists() is False

        result = sentry_app_region_service.create_external_issue(
            organization_id=self.org.id,
            installation=self.rpc_installation,
            group_id=self.group.id,
            web_url="https://example.com/project/issue-1",
            project="ProjectName",
            identifier="issue-1",
        )

        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert PlatformExternalIssue.objects.filter(group_id=self.group.id).exists()

        assert result.error is None
        assert result.external_issue is not None
        assert result.external_issue.issue_id == str(self.group.id)
        assert result.external_issue.web_url == "https://example.com/project/issue-1"
        assert result.external_issue.display_name == "ProjectName#issue-1"

    def test_create_external_issue_group_not_found(self) -> None:
        result = sentry_app_region_service.create_external_issue(
            organization_id=self.org.id,
            installation=self.rpc_installation,
            group_id=99999999,
            web_url="https://example.com/project/issue-1",
            project="ProjectName",
            identifier="issue-1",
        )

        assert result.error is not None
        assert result.external_issue is None
        assert result.error.status_code == 404

    def test_delete_external_issue(self) -> None:
        with assume_test_silo_mode_of(PlatformExternalIssue):
            external_issue = PlatformExternalIssue.objects.create(
                group_id=self.group.id,
                project_id=self.project.id,
                service_type=self.sentry_app.slug,
                display_name="Test#123",
                web_url="https://example.com/issue/123",
            )

        result = sentry_app_region_service.delete_external_issue(
            organization_id=self.org.id,
            installation=self.rpc_installation,
            external_issue_id=external_issue.id,
        )

        assert result.success is True
        assert result.error is None
        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert not PlatformExternalIssue.objects.filter(id=external_issue.id).exists()

    def test_delete_external_issue_not_found(self) -> None:
        result = sentry_app_region_service.delete_external_issue(
            organization_id=self.org.id,
            installation=self.rpc_installation,
            external_issue_id=99999999,
        )

        assert result.success is False
        assert result.error is not None
        assert result.error.status_code == 404

    def test_get_service_hook_projects(self) -> None:
        project2 = self.create_project(organization=self.org)

        with assume_test_silo_mode_of(ServiceHook):
            hook = ServiceHook.objects.get(installation_id=self.install.id)
            ServiceHookProject.objects.create(service_hook_id=hook.id, project_id=self.project.id)
            ServiceHookProject.objects.create(service_hook_id=hook.id, project_id=project2.id)

        result = sentry_app_region_service.get_service_hook_projects(
            organization_id=self.org.id,
            installation=self.rpc_installation,
        )

        assert result.error is None
        assert {hp.project_id for hp in result.service_hook_projects} == {
            self.project.id,
            project2.id,
        }
        assert all(hp.id is not None for hp in result.service_hook_projects)
        assert result.next_cursor is None

    def test_get_service_hook_projects_empty(self) -> None:
        result = sentry_app_region_service.get_service_hook_projects(
            organization_id=self.org.id,
            installation=self.rpc_installation,
        )

        assert result.error is None
        assert result.service_hook_projects == []
        assert result.next_cursor is None

    def test_get_service_hook_projects_paginated(self) -> None:
        project2 = self.create_project(organization=self.org)
        project3 = self.create_project(organization=self.org)

        with assume_test_silo_mode_of(ServiceHook):
            hook = ServiceHook.objects.get(installation_id=self.install.id)
            ServiceHookProject.objects.create(service_hook_id=hook.id, project_id=self.project.id)
            ServiceHookProject.objects.create(service_hook_id=hook.id, project_id=project2.id)
            ServiceHookProject.objects.create(service_hook_id=hook.id, project_id=project3.id)

        result = sentry_app_region_service.get_service_hook_projects(
            organization_id=self.org.id,
            installation=self.rpc_installation,
            limit=2,
        )

        assert result.error is None
        assert len(result.service_hook_projects) == 2
        assert result.next_cursor == 2

        result2 = sentry_app_region_service.get_service_hook_projects(
            organization_id=self.org.id,
            installation=self.rpc_installation,
            cursor=result.next_cursor,
            limit=2,
        )

        assert result2.error is None
        assert len(result2.service_hook_projects) == 1
        assert result2.next_cursor is None

    def test_set_service_hook_projects(self) -> None:
        project2 = self.create_project(organization=self.org)
        project3 = self.create_project(organization=self.org)

        with assume_test_silo_mode_of(ServiceHook):
            hook = ServiceHook.objects.get(installation_id=self.install.id)
            ServiceHookProject.objects.create(service_hook_id=hook.id, project_id=self.project.id)

        result = sentry_app_region_service.set_service_hook_projects(
            organization_id=self.org.id,
            installation=self.rpc_installation,
            project_ids=[project2.id, project3.id],
        )

        assert result.error is None
        assert {hp.project_id for hp in result.service_hook_projects} == {project2.id, project3.id}
        assert all(hp.id is not None for hp in result.service_hook_projects)
        assert result.next_cursor is None

        with assume_test_silo_mode_of(ServiceHookProject):
            assert not ServiceHookProject.objects.filter(
                service_hook_id=hook.id, project_id=self.project.id
            ).exists()
            assert ServiceHookProject.objects.filter(
                service_hook_id=hook.id, project_id=project2.id
            ).exists()
            assert ServiceHookProject.objects.filter(
                service_hook_id=hook.id, project_id=project3.id
            ).exists()

    def test_set_service_hook_projects_partial_overlap(self) -> None:
        project2 = self.create_project(organization=self.org)
        project3 = self.create_project(organization=self.org)

        with assume_test_silo_mode_of(ServiceHook):
            hook = ServiceHook.objects.get(installation_id=self.install.id)
            ServiceHookProject.objects.create(service_hook_id=hook.id, project_id=self.project.id)
            ServiceHookProject.objects.create(service_hook_id=hook.id, project_id=project2.id)

        result = sentry_app_region_service.set_service_hook_projects(
            organization_id=self.org.id,
            installation=self.rpc_installation,
            project_ids=[project2.id, project3.id],
        )

        assert result.error is None
        assert {hp.project_id for hp in result.service_hook_projects} == {project2.id, project3.id}
        assert all(hp.id is not None for hp in result.service_hook_projects)
        assert result.next_cursor is None

        with assume_test_silo_mode_of(ServiceHookProject):
            assert not ServiceHookProject.objects.filter(
                service_hook_id=hook.id, project_id=self.project.id
            ).exists()
            assert ServiceHookProject.objects.filter(
                service_hook_id=hook.id, project_id=project2.id
            ).exists()
            assert ServiceHookProject.objects.filter(
                service_hook_id=hook.id, project_id=project3.id
            ).exists()

    def test_delete_service_hook_projects(self) -> None:
        project2 = self.create_project(organization=self.org)

        with assume_test_silo_mode_of(ServiceHook):
            hook = ServiceHook.objects.get(installation_id=self.install.id)
            ServiceHookProject.objects.create(service_hook_id=hook.id, project_id=self.project.id)
            ServiceHookProject.objects.create(service_hook_id=hook.id, project_id=project2.id)

        result = sentry_app_region_service.delete_service_hook_projects(
            organization_id=self.org.id,
            installation=self.rpc_installation,
        )

        assert result.success is True
        assert result.error is None
        with assume_test_silo_mode_of(ServiceHookProject):
            assert not ServiceHookProject.objects.filter(service_hook_id=hook.id).exists()

    def test_delete_service_hook_projects_empty(self) -> None:
        result = sentry_app_region_service.delete_service_hook_projects(
            organization_id=self.org.id,
            installation=self.rpc_installation,
        )

        assert result.success is True
        assert result.error is None
