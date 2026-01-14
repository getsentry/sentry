import orjson
import responses
from django.utils.http import urlencode
from responses.matchers import query_string_matcher

from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
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
