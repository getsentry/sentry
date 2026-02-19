import datetime
from collections.abc import Mapping, Sequence
from functools import cached_property
from typing import cast
from unittest import mock
from unittest.mock import MagicMock, patch

import orjson
import pytest
import responses
from django.test import RequestFactory
from django.utils import timezone
from pytest import fixture

from sentry.incidents.grouptype import MetricIssue
from sentry.integrations.github import client
from sentry.integrations.github.integration import GitHubIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.services.integration import integration_service
from sentry.issues.grouptype import FeedbackGroup, PerformanceNPlusOneGroupType, ReplayRageClickType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.models.group import Group
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import (
    IntegrationConfigurationError,
    IntegrationError,
    IntegrationFormError,
)
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_BASE_URL_HEADER, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils.cases import IntegratedApiTestCase, PerformanceIssueTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@all_silo_test
class GitHubIssueBasicAllSiloTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        ten_days = timezone.now() + datetime.timedelta(days=10)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="github_external_id",
            name="getsentry",
            metadata={
                "access_token": "some-token",
                "expires_at": ten_days.strftime("%Y-%m-%dT%H:%M:%S"),
            },
        )
        install = self.integration.get_installation(self.organization.id)
        self.install = cast(GitHubIntegration, install)

    @fixture(autouse=True)
    def stub_get_jwt(self):
        with patch.object(client, "get_jwt", return_value="jwt_token_1"):
            yield

    @responses.activate
    def test_get_create_issue_config_without_group(self) -> None:
        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={
                "total_count": 2,
                "repositories": [
                    {"full_name": "getsentry/sentry", "name": "sentry"},
                    {"full_name": "getsentry/other", "name": "other", "archived": True},
                ],
            },
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/assignees",
            json=[{"login": "leeandher"}],
        )

        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/labels",
            json=[
                {"name": "bug"},
                {"name": "not-bug"},
            ],
        )

        install = self.install
        config = install.get_create_issue_config(None, self.user, params={})
        [repo_field, assignee_field, label_field] = config
        assert repo_field["name"] == "repo"
        assert repo_field["type"] == "select"
        assert repo_field["label"] == "GitHub Repository"
        assert assignee_field["name"] == "assignee"
        assert assignee_field["type"] == "select"
        assert assignee_field["label"] == "Assignee"
        assert label_field["name"] == "labels"
        assert label_field["type"] == "select"
        assert label_field["label"] == "Labels"


class GitHubIssueBasicTest(TestCase, PerformanceIssueTestCase, IntegratedApiTestCase):
    @cached_property
    def request(self):
        return RequestFactory()

    def setUp(self) -> None:
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="github_external_id",
            name="getsentry",
        )
        install = self.integration.get_installation(self.organization.id)
        self.install = cast(GitHubIntegration, install)
        self.min_ago = before_now(minutes=1).isoformat()
        self.repo = "getsentry/sentry"

    def _generate_pagination_responses(
        self, api_url: str, data: Sequence[Mapping[str, str]], per_page_limit: int
    ) -> None:
        pages = len(data) // per_page_limit + 1

        for page in range(1, pages + 1):
            params = (
                f"per_page={per_page_limit}&page={page}"
                if page != 1
                else f"per_page={per_page_limit}"
            )
            link = _get_link_header(api_url, page, per_page_limit, pages)
            responses.add(
                responses.GET,
                f"{api_url}?{params}",
                json=_get_page_data(data, page, per_page_limit),
                headers={"Link": link} if link else None,
            )

    @fixture(autouse=True)
    def stub_get_jwt(self):
        with patch.object(client, "get_jwt", return_value="jwt_token_1"):
            yield

    def _check_proxying(self) -> None:
        assert self.install.org_integration is not None
        for call_request in responses.calls:
            request = call_request.request
            assert request.headers[PROXY_OI_HEADER] == str(self.install.org_integration.id)
            assert request.headers[PROXY_BASE_URL_HEADER] == "https://api.github.com"
            assert PROXY_SIGNATURE_HEADER in request.headers

    def _stub_create_issue_config_dependencies(
        self,
    ) -> tuple[str, list[tuple[str, str]]]:
        default_repo = "getsentry/sentry"
        repo_choices = [("getsentry/sentry", "sentry")]
        return (default_repo, repo_choices)

    @responses.activate
    def test_get_allowed_assignees(self) -> None:
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/assignees",
            json=[{"login": "MeredithAnya"}],
        )

        assert self.install.get_allowed_assignees(self.repo) == (
            ("", "Unassigned"),
            ("MeredithAnya", "MeredithAnya"),
        )

        if self.should_call_api_without_proxying():
            assert len(responses.calls) == 2

            request = responses.calls[0].request
            assert request.headers["Authorization"] == "Bearer jwt_token_1"

            request = responses.calls[1].request
            assert request.headers["Authorization"] == "Bearer token_1"
        else:
            self._check_proxying()

    @responses.activate
    def test_get_repo_labels(self) -> None:
        """Test that labels are fetched using pagination when the feature flag is enabled."""
        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github_external_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

        per_page_limit = 5
        # An extra label to test pagination
        labels = [
            {"name": "bug"},
            {"name": "enhancement"},
            {"name": "duplicate"},
            {"name": "1"},
            {"name": "10"},
            {"name": "2"},
        ]
        api_url = "https://api.github.com/repos/getsentry/sentry/labels"
        self._generate_pagination_responses(api_url, labels, per_page_limit)

        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.page_size", new=len(labels) - 1
        ):
            # results should be sorted alphabetically
            assert self.install.get_repo_labels("getsentry", "sentry") == (
                ("1", "1"),
                ("2", "2"),
                ("10", "10"),
                ("bug", "bug"),
                ("duplicate", "duplicate"),
                ("enhancement", "enhancement"),
            )

            if self.should_call_api_without_proxying():
                assert len(responses.calls) == 2

                request = responses.calls[0].request
                assert request.headers["Authorization"] == "Bearer jwt_token_1"

                request = responses.calls[1].request
                assert request.headers["Authorization"] == "Bearer token_1"
            else:
                self._check_proxying()

    @responses.activate
    def test_create_issue(self) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            Repository.objects.create(
                name="getsentry/sentry",
                provider="integrations:github",
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )

        responses.add(
            responses.POST,
            "https://api.github.com/repos/getsentry/sentry/issues",
            json={
                "number": 321,
                "title": "hello",
                "body": "This is the description",
                "html_url": "https://github.com/getsentry/sentry/issues/231",
            },
        )

        form_data = {
            "repo": "getsentry/sentry",
            "title": "hello",
            "description": "This is the description",
        }

        assert self.install.create_issue(form_data) == {
            "key": 321,
            "description": "This is the description",
            "title": "hello",
            "url": "https://github.com/getsentry/sentry/issues/231",
            "repo": "getsentry/sentry",
        }

        if self.should_call_api_without_proxying():
            assert len(responses.calls) == 2

            request = responses.calls[0].request
            assert request.headers["Authorization"] == "Bearer jwt_token_1"

            request = responses.calls[1].request
            assert request.headers["Authorization"] == "Bearer token_1"
            payload = orjson.loads(request.body)
            assert payload == {
                "body": "This is the description",
                "assignee": None,
                "title": "hello",
                "labels": None,
            }
        else:
            self._check_proxying()

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_create_issue_with_invalid_field(self, mock_record: MagicMock) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            Repository.objects.create(
                name="getsentry/sentry",
                provider="integrations:github",
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )

        responses.add(
            responses.POST,
            "https://api.github.com/repos/getsentry/sentry/issues",
            status=422,
            json={
                "message": "Validation Failed",
                "errors": [
                    {
                        "value": "example_username",
                        "resource": "Issue",
                        "field": "assignee",
                        "code": "invalid",
                    }
                ],
                "documentation_url": "https://docs.github.com/rest/issues/issues#create-an-issue",
                "status": "422",
            },
        )

        form_data = {
            "repo": "getsentry/sentry",
            "title": "hello",
            "description": "This is the description",
        }

        with pytest.raises(IntegrationFormError) as e:
            self.install.create_issue(form_data)

        assert e.value.field_errors == {
            "assignee": "Got invalid value: example_username for field: assignee"
        }

    @responses.activate
    def test_create_issue_with_bad_github_repo(self) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            Repository.objects.create(
                name="getsentry/sentry",
                provider="integrations:github",
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )

        responses.add(
            responses.POST,
            "https://api.github.com/repos/getsentry/sentry/issues",
            status=410,
            json={
                "message": "Issues are disabled for this repo",
                "documentation_url": "https://docs.github.com/v3/issues/",
                "status": "410",
            },
        )

        form_data = {
            "repo": "getsentry/sentry",
            "title": "hello",
            "description": "This is the description",
        }

        with pytest.raises(IntegrationConfigurationError) as e:
            self.install.create_issue(form_data)

        assert (
            e.value.args[0]
            == "Issues are disabled for this repository, please check your repository permissions"
        )

    @responses.activate
    def test_create_issue_with_bad_github_repo_permissions(self) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            Repository.objects.create(
                name="getsentry/sentry",
                provider="integrations:github",
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )

        responses.add(
            responses.POST,
            "https://api.github.com/repos/getsentry/sentry/issues",
            status=403,
            json={
                "message": "Repository was archived so is read-only.",
                "documentation_url": "https://docs.github.com/rest/issues/issues#create-an-issue",
                "status": "403",
            },
        )

        form_data = {
            "repo": "getsentry/sentry",
            "title": "hello",
            "description": "This is the description",
        }

        with pytest.raises(IntegrationConfigurationError) as e:
            self.install.create_issue(form_data)

        assert e.value.args[0] == "Repository was archived so is read-only."

    @responses.activate
    def test_create_issue_raises_integration_error(self) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            Repository.objects.create(
                name="getsentry/sentry",
                provider="integrations:github",
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )

        responses.add(
            responses.POST,
            "https://api.github.com/repos/getsentry/sentry/issues",
            status=500,
            json={
                "message": "dang snap!",
                "documentation_url": "https://docs.github.com/v3/issues/",
                "status": "500",
            },
        )

        form_data = {
            "repo": "getsentry/sentry",
            "title": "hello",
            "description": "This is the description",
        }

        with pytest.raises(IntegrationError) as e:
            self.install.create_issue(form_data)

        assert e.value.args[0] == "Error Communicating with GitHub (HTTP 500): dang snap!"

    def test_create_issue_with_repo_not_belonging_to_integration(self) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            Repository.objects.create(
                name="getsentry/sentry",
                provider="integrations:github",
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )

        # Try to create issue with a repo that doesn't belong to this installation
        form_data = {
            "repo": "different-org/different-repo",
            "title": "hello",
            "description": "This is the description",
        }

        with pytest.raises(IntegrationFormError) as exc_info:
            self.install.create_issue(form_data)

        assert exc_info.value.field_errors == {
            "repo": "Given repository, different-org/different-repo does not belong to this installation"
        }

    @responses.activate
    def test_create_issue_with_valid_repo_ownership(self) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            Repository.objects.create(
                name="getsentry/sentry",
                provider="integrations:github",
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )

        responses.add(
            responses.POST,
            "https://api.github.com/repos/getsentry/sentry/issues",
            json={
                "number": 321,
                "title": "hello",
                "body": "This is the description",
                "html_url": "https://github.com/getsentry/sentry/issues/321",
            },
        )

        form_data = {
            "repo": "getsentry/sentry",
            "title": "hello",
            "description": "This is the description",
        }

        result = self.install.create_issue(form_data)

        assert result == {
            "key": 321,
            "description": "This is the description",
            "title": "hello",
            "url": "https://github.com/getsentry/sentry/issues/321",
            "repo": "getsentry/sentry",
        }

    def test_get_issue_with_repo_not_belonging_to_integration(self) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            Repository.objects.create(
                name="getsentry/sentry",
                provider="integrations:github",
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )

        data = {"repo": "different-org/different-repo", "externalIssue": "321"}

        with pytest.raises(IntegrationFormError) as exc_info:
            self.install.get_issue("321", data=data)

        assert exc_info.value.field_errors == {
            "repo": "Given repository, different-org/different-repo does not belong to this installation"
        }

    @responses.activate
    def test_get_issue_with_valid_repo_ownership(self) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            Repository.objects.create(
                name="getsentry/sentry",
                provider="integrations:github",
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )

        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/issues/321",
            json={
                "number": "321",
                "title": "Test Issue",
                "body": "Test Description",
                "html_url": "https://github.com/getsentry/sentry/issues/321",
            },
        )

        data = {"repo": "getsentry/sentry", "externalIssue": "321"}
        result = self.install.get_issue("321", data=data)

        assert result == {
            "key": "321",
            "title": "Test Issue",
            "description": "Test Description",
            "url": "https://github.com/getsentry/sentry/issues/321",
            "repo": "getsentry/sentry",
        }

    def test_performance_issues_content(self) -> None:
        """Test that a GitHub issue created from a performance issue has the expected title and description"""
        event = self.create_performance_issue()
        assert event.group is not None
        description = self.install.get_group_description(event.group, event)
        assert "db - SELECT `books_author`.`id`, `books_author" in description
        title = self.install.get_group_title(event.group, event)
        assert title == "N+1 Query"

    def test_generic_issues_content(self) -> None:
        """Test that a GitHub issue created from a generic issue has the expected title and description"""

        occurrence = TEST_ISSUE_OCCURRENCE
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        group_event = event.for_group(event.groups[0])
        group_event.occurrence = occurrence

        description = self.install.get_group_description(group_event.group, group_event)
        assert "|  |  |" in description
        assert "| ------------- | --------------- |" in description
        assert occurrence.evidence_display[0].value in description
        assert occurrence.evidence_display[1].value in description
        assert occurrence.evidence_display[2].value in description
        title = self.install.get_group_title(group_event.group, group_event)
        assert title == occurrence.issue_title

    def test_metric_issue_content_falls_back_to_evidence_data_when_display_is_empty(self) -> None:
        event = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "metric issue",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert event.group is not None

        group_event = event.for_group(event.group)
        group_event.occurrence = IssueOccurrence(
            id="metric-occurrence-description",
            project_id=self.project.id,
            event_id=event.event_id,
            fingerprint=["metric-issue"],
            issue_title="Error Rate Alert",
            subtitle="Critical: Number of events in the last 5 minutes above 100",
            resource_id=None,
            evidence_data={
                "alert_id": 42,
                "value": 5026.1,
                "conditions": [
                    {
                        "type": "gt",
                        "comparison": 0,
                        "condition_result": 1,
                    }
                ],
                "data_sources": [
                    {
                        "query_obj": {
                            "snuba_query": {
                                "dataset": "metrics",
                                "aggregate": "p50(value,dashboards.widget_query_queue.time_to_empty,distribution,-)",
                                "time_window": 3600,
                            }
                        }
                    }
                ],
            },
            evidence_display=[],
            type=MetricIssue,
            detection_time=before_now(minutes=1),
            level="error",
            culprit="",
        )

        description = self.install.get_group_description(group_event.group, group_event)

        assert "Metric Details:" in description
        assert "- **Metric Alert**: [View alert rule](" in description
        assert "/alerts/rules/" in description
        assert "- **Dataset**: Metrics" in description
        assert (
            "- **Aggregate**: p50(value,dashboards.widget_query_queue.time_to_empty,distribution,-)"
            in description
        )
        assert "- **Interval**: 1 hour" in description
        assert "- **Condition**: Above 0" in description
        assert "- **Evaluated Value**: 5,026.1" in description
        assert "|  |  |" not in description

    def test_error_issues_content(self) -> None:
        """Test that a GitHub issue created from an error issue has the expected title and descriptionn"""
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert event.group is not None

        description = self.install.get_group_description(event.group, event)
        assert "oh no" in description
        title = self.install.get_group_title(event.group, event)
        assert title == event.title

    def test_get_create_issue_config_uses_legacy_defaults_when_flag_disabled(self) -> None:
        event = self.create_performance_issue()
        assert event.group is not None
        default_repo, repo_choices = self._stub_create_issue_config_dependencies()

        with (
            mock.patch.object(
                self.install,
                "get_repository_choices",
                return_value=(default_repo, repo_choices),
            ),
            mock.patch.object(
                self.install, "get_allowed_assignees", return_value=(("", "Unassigned"),)
            ),
            mock.patch.object(self.install, "get_repo_labels", return_value=(("bug", "bug"),)),
        ):
            fields = self.install.get_create_issue_config(event.group, self.user)

        description_field = next(field for field in fields if field["name"] == "description")
        assert "|  |  |" in description_field["default"]
        assert "Query Evidence:" not in description_field["default"]

    def test_get_create_issue_config_uses_enhanced_defaults_for_db_query(self) -> None:
        event = self.store_event(
            data={
                "event_id": "f" * 32,
                "message": "query issue",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert event.group is not None

        db_query = "db - SELECT * FROM `users` WHERE users.id = 1"
        group_event = event.for_group(event.group)
        group_event.occurrence = IssueOccurrence(
            id="github-db-occurrence",
            project_id=self.project.id,
            event_id=event.event_id,
            fingerprint=["performance-n-plus-one"],
            issue_title="N+1 DB Query",
            subtitle="Repeated DB queries detected",
            resource_id=None,
            evidence_data={"num_repeating_spans": "12"},
            evidence_display=[
                IssueEvidence(name="Offending Spans", value=db_query, important=True)
            ],
            type=PerformanceNPlusOneGroupType,
            detection_time=before_now(minutes=1),
            level="error",
            culprit="",
        )

        default_repo, repo_choices = self._stub_create_issue_config_dependencies()
        with (
            self.feature("organizations:integrations-github-issue-defaults-enhanced"),
            mock.patch.object(Group, "get_latest_event", return_value=group_event),
            mock.patch.object(
                self.install,
                "get_repository_choices",
                return_value=(default_repo, repo_choices),
            ),
            mock.patch.object(
                self.install, "get_allowed_assignees", return_value=(("", "Unassigned"),)
            ),
            mock.patch.object(self.install, "get_repo_labels", return_value=(("bug", "bug"),)),
        ):
            fields = self.install.get_create_issue_config(event.group, self.user)

        title_field = next(field for field in fields if field["name"] == "title")
        description_field = next(field for field in fields if field["name"] == "description")
        assert (
            title_field["default"] == "N+1 DB Query: db - SELECT * FROM `users` WHERE users.id = 1"
        )
        assert "Query Evidence:" in description_field["default"]
        assert "Offending Spans:\n```" in description_field["default"]
        assert f"{db_query}\n```" in description_field["default"]
        assert "|  |  |" not in description_field["default"]

    def test_get_create_issue_config_uses_enhanced_defaults_for_replay_issue(self) -> None:
        event = self.store_event(
            data={
                "event_id": "e" * 32,
                "message": "replay issue",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert event.group is not None

        selector_path = "div.page > button[data-test-id='signup']"
        group_event = event.for_group(event.group)
        group_event.occurrence = IssueOccurrence(
            id="github-replay-occurrence",
            project_id=self.project.id,
            event_id=event.event_id,
            fingerprint=["replay-click-rage"],
            issue_title="Rage Click",
            subtitle=selector_path,
            resource_id=None,
            evidence_data={"selector": selector_path},
            evidence_display=[
                IssueEvidence(name="Clicked Element", value="button#signup", important=False),
                IssueEvidence(name="Selector Path", value=selector_path, important=False),
                IssueEvidence(name="React Component Name", value="StyledButton", important=True),
            ],
            type=ReplayRageClickType,
            detection_time=before_now(minutes=1),
            level="error",
            culprit="",
        )

        default_repo, repo_choices = self._stub_create_issue_config_dependencies()
        with (
            self.feature("organizations:integrations-github-issue-defaults-enhanced"),
            mock.patch.object(Group, "get_latest_event", return_value=group_event),
            mock.patch.object(
                self.install,
                "get_repository_choices",
                return_value=(default_repo, repo_choices),
            ),
            mock.patch.object(
                self.install, "get_allowed_assignees", return_value=(("", "Unassigned"),)
            ),
            mock.patch.object(self.install, "get_repo_labels", return_value=(("bug", "bug"),)),
        ):
            fields = self.install.get_create_issue_config(event.group, self.user)

        title_field = next(field for field in fields if field["name"] == "title")
        description_field = next(field for field in fields if field["name"] == "description")
        assert title_field["default"] == "Rage Click: StyledButton"
        assert "Interaction Evidence:" in description_field["default"]
        assert "Selector Path:\n```" in description_field["default"]
        assert f"{selector_path}\n```" in description_field["default"]

    def test_get_create_issue_config_uses_enhanced_defaults_for_metric_issue(self) -> None:
        event = self.store_event(
            data={
                "event_id": "d" * 32,
                "message": "metric issue",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert event.group is not None

        group_event = event.for_group(event.group)
        group_event.occurrence = IssueOccurrence(
            id="github-metric-occurrence",
            project_id=self.project.id,
            event_id=event.event_id,
            fingerprint=["metric-issue"],
            issue_title="Error Rate Alert",
            subtitle="Critical: Number of events in the last 5 minutes above 100",
            resource_id=None,
            evidence_data={
                "alert_id": 42,
                "value": 5026.1,
                "conditions": [
                    {
                        "type": "gt",
                        "comparison": 0,
                        "condition_result": 1,
                    }
                ],
                "data_sources": [
                    {
                        "query_obj": {
                            "snuba_query": {
                                "dataset": "metrics",
                                "aggregate": "p50(value,dashboards.widget_query_queue.time_to_empty,distribution,-)",
                                "time_window": 3600,
                            }
                        }
                    }
                ],
            },
            evidence_display=[],
            type=MetricIssue,
            detection_time=before_now(minutes=1),
            level="error",
            culprit="",
        )

        default_repo, repo_choices = self._stub_create_issue_config_dependencies()
        with (
            self.feature("organizations:integrations-github-issue-defaults-enhanced"),
            mock.patch.object(Group, "get_latest_event", return_value=group_event),
            mock.patch.object(
                self.install,
                "get_repository_choices",
                return_value=(default_repo, repo_choices),
            ),
            mock.patch.object(
                self.install, "get_allowed_assignees", return_value=(("", "Unassigned"),)
            ),
            mock.patch.object(self.install, "get_repo_labels", return_value=(("bug", "bug"),)),
        ):
            fields = self.install.get_create_issue_config(event.group, self.user)

        description_field = next(field for field in fields if field["name"] == "description")
        assert "Metric Details:" in description_field["default"]
        assert "- **Metric Alert**: [View alert rule](" in description_field["default"]
        assert "- **Condition**: Above 0" in description_field["default"]
        assert "- **Evaluated Value**: 5,026.1" in description_field["default"]
        assert "Evidence:" not in description_field["default"]

    def test_get_create_issue_config_enhanced_defaults_preserves_event_context_markdown(
        self,
    ) -> None:
        event = self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "error issue",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert event.group is not None

        default_repo, repo_choices = self._stub_create_issue_config_dependencies()
        with (
            self.feature("organizations:integrations-github-issue-defaults-enhanced"),
            mock.patch.object(
                self.install, "get_group_body", return_value="line1\nSELECT * FROM `users`"
            ),
            mock.patch.object(
                self.install,
                "get_repository_choices",
                return_value=(default_repo, repo_choices),
            ),
            mock.patch.object(
                self.install, "get_allowed_assignees", return_value=(("", "Unassigned"),)
            ),
            mock.patch.object(self.install, "get_repo_labels", return_value=(("bug", "bug"),)),
        ):
            fields = self.install.get_create_issue_config(event.group, self.user)

        description_field = next(field for field in fields if field["name"] == "description")
        assert "Event Context:\n```" in description_field["default"]
        assert "SELECT * FROM `users`" in description_field["default"]
        assert "```" in description_field["default"]

    @responses.activate
    def test_link_issue(self) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            Repository.objects.create(
                name="getsentry/sentry",
                provider="integrations:github",
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )

        issue_id = "321"

        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/issues/321",
            json={
                "number": issue_id,
                "title": "hello",
                "body": "This is the description",
                "html_url": "https://github.com/getsentry/sentry/issues/231",
            },
        )

        data = {"repo": "getsentry/sentry", "externalIssue": issue_id, "comment": "hello"}

        assert self.install.get_issue(issue_id, data=data) == {
            "key": issue_id,
            "description": "This is the description",
            "title": "hello",
            "url": "https://github.com/getsentry/sentry/issues/231",
            "repo": "getsentry/sentry",
        }

        if self.should_call_api_without_proxying():
            assert len(responses.calls) == 2

            request = responses.calls[0].request
            assert request.headers["Authorization"] == "Bearer jwt_token_1"

            request = responses.calls[1].request
            assert request.headers["Authorization"] == "Bearer token_1"
        else:
            self._check_proxying()

    @responses.activate
    def test_repo_dropdown_choices(self) -> None:
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )

        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/assignees",
            json=[{"login": "MeredithAnya"}],
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/labels",
            json=[{"name": "bug"}, {"name": "enhancement"}],
        )

        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={
                "total_count": 2,
                "repositories": [
                    {"full_name": "getsentry/sentry", "name": "sentry"},
                    {"full_name": "getsentry/other", "name": "other", "archived": True},
                ],
            },
        )

        resp = self.install.get_create_issue_config(group=event.group, user=self.user)
        assert resp[0]["choices"] == [("getsentry/sentry", "sentry")]

        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/hello/assignees",
            json=[{"login": "MeredithAnya"}],
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/hello/labels",
            json=[{"name": "bug"}, {"name": "enhancement"}],
        )

        # create an issue
        data = {"params": {"repo": "getsentry/hello"}}
        resp = self.install.get_create_issue_config(group=event.group, user=self.user, **data)
        assert resp[0]["choices"] == [
            ("getsentry/hello", "hello"),
            ("getsentry/sentry", "sentry"),
        ]
        # link an issue
        data = {"params": {"repo": "getsentry/hello"}}
        assert event.group is not None
        resp = self.install.get_link_issue_config(group=event.group, **data)
        assert resp[0]["choices"] == [
            ("getsentry/hello", "hello"),
            ("getsentry/sentry", "sentry"),
        ]

    @responses.activate
    def test_linked_issue_comment(self) -> None:
        issue_event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )
        feedback_issue = self.create_group(project=self.project, type=FeedbackGroup.type_id)

        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={
                "total_count": 2,
                "repositories": [
                    {"full_name": "getsentry/sentry", "name": "sentry"},
                    {"full_name": "getsentry/other", "name": "other", "archived": True},
                ],
            },
        )

        # link an issue
        data = {"params": {"repo": "getsentry/hello"}}
        assert issue_event.group is not None
        resp = self.install.get_link_issue_config(group=issue_event.group, **data)
        # assert comment wording for linked issue is correct
        assert "Sentry Issue" in resp[2]["default"]

        # link a feedback issue
        resp = self.install.get_link_issue_config(group=feedback_issue, **data)
        # assert comment wording for linked feedback is correct
        assert "Sentry Feedback" in resp[2]["default"]

        # ensure linked comment is a string
        assert isinstance(resp[1]["default"], str)
        assert isinstance(resp[0]["default"], str)

    @responses.activate
    def after_link_issue(self):
        responses.add(
            responses.POST,
            "https://api.github.com/repos/getsentry/sentry/issues/321/comments",
            json={"body": "hello"},
        )

        data = {"comment": "hello"}
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key="hello#321",
        )

        self.install.after_link_issue(external_issue, data=data)

        request = responses.calls[0].request
        assert request.headers["Authorization"] == b"Bearer jwt_token_1"

        request = responses.calls[1].request
        assert request.headers["Authorization"] == "Bearer token_1"
        payload = orjson.loads(request.body)
        assert payload == {"body": "hello"}

    @responses.activate
    def test_default_repo_link_fields(self) -> None:
        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={
                "total_count": 1,
                "repositories": [{"name": "sentry", "full_name": "getsentry/sentry"}],
            },
        )
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )
        assert event.group is not None
        group = event.group
        assert self.install.org_integration is not None
        integration_service.update_organization_integration(
            org_integration_id=self.install.org_integration.id,
            config={
                "project_issue_defaults": {str(group.project_id): {"repo": "getsentry/sentry"}}
            },
        )
        fields = self.install.get_link_issue_config(group)
        for field in fields:
            if field["name"] == "repo":
                repo_field = field
                break
        assert repo_field["default"] == "getsentry/sentry"

    @responses.activate
    def test_default_repo_create_fields(self) -> None:
        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={
                "total_count": 1,
                "repositories": [{"name": "sentry", "full_name": "getsentry/sentry"}],
            },
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/assignees",
            json=[{"login": "MeredithAnya"}],
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/labels",
            json=[{"name": "bug"}, {"name": "enhancement"}],
        )
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )
        assert event.group is not None
        group = event.group
        assert self.install.org_integration is not None
        integration_service.update_organization_integration(
            org_integration_id=self.install.org_integration.id,
            config={
                "project_issue_defaults": {str(group.project_id): {"repo": "getsentry/sentry"}}
            },
        )
        fields = self.install.get_create_issue_config(group, self.user)
        for field in fields:
            if field["name"] == "repo":
                repo_field = field
                break
        assert repo_field["default"] == "getsentry/sentry"

    @responses.activate
    def test_default_repo_link_fields_no_repos(self) -> None:
        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={"total_count": 0, "repositories": []},
        )
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )
        assert event.group is not None
        fields = self.install.get_link_issue_config(event.group)
        repo_field = [field for field in fields if field["name"] == "repo"][0]
        assert repo_field["default"] == ""
        assert repo_field["choices"] == []

    @responses.activate
    def test_default_repo_create_fields_no_repos(self) -> None:
        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={"total_count": 0, "repositories": []},
        )
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )
        fields = self.install.get_create_issue_config(event.group, self.user)
        repo_field = [field for field in fields if field["name"] == "repo"][0]
        assignee_field = [field for field in fields if field["name"] == "assignee"][0]

        assert repo_field["default"] == ""
        assert repo_field["choices"] == []
        assert assignee_field["default"] == ""
        assert assignee_field["choices"] == []


def _get_page_data(
    data: Sequence[Mapping[str, str]], page: int, per_page_limit: int
) -> Sequence[Mapping[str, str]]:
    start = per_page_limit * (page - 1)
    end = per_page_limit * page
    return data[start:end]


def _get_link_header(api_url: str, page: int, per_page_limit: int, pages: int) -> str:
    if pages == 1:
        return ""

    list_of_links = []
    first_link = f'<{api_url}?per_page={per_page_limit}&page=1>; rel="first"'
    last_link = f'<{api_url}?per_page={per_page_limit}&page={pages}>; rel="last"'
    next_link = f'<{api_url}?per_page={per_page_limit}&page={page + 1}>; rel="next"'
    prev_link = f'<{api_url}?per_page={per_page_limit}&page={page - 1}>; rel="prev"'

    if page != 1:
        list_of_links.append(first_link)

    if page == pages:
        list_of_links.append(last_link)

    if page != pages:
        list_of_links.append(next_link)

    if page != 1:
        list_of_links.append(prev_link)

    return ", ".join(list_of_links) if len(list_of_links) > 0 else ""
