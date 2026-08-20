from __future__ import annotations

from typing import Any

import orjson
import pytest
import responses

from fixtures.gitea import BASE_URL, REPO_PATH, GiteaTestCase
from sentry.shared_integrations.exceptions import IntegrationError, IntegrationFormError
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from sentry.utils.http import absolute_uri

pytestmark = [requires_snuba]

API_URL = f"{BASE_URL}/api/v1"


def issue_payload(number: int = 5, **overrides: Any) -> dict[str, Any]:
    payload = {
        "id": 900,
        "number": number,
        "title": "Something broke",
        "body": "A description",
        "html_url": f"{BASE_URL}/{REPO_PATH}/issues/{number}",
        "state": "open",
    }
    payload.update(overrides)
    return payload


class GiteaIssuesTest(GiteaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_gitea_repo()
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        assert event.group is not None
        self.group = event.group

    def _mock_repo_search(self) -> None:
        responses.add(
            responses.GET,
            f"{API_URL}/repos/search",
            json={
                "ok": True,
                "data": [
                    {
                        "id": 15,
                        "name": "widgets",
                        "full_name": REPO_PATH,
                        "html_url": f"{BASE_URL}/{REPO_PATH}",
                        "default_branch": "main",
                    }
                ],
            },
        )

    def test_make_external_key(self) -> None:
        assert (
            self.installation.make_external_key({"repo": REPO_PATH, "key": 5}) == f"{REPO_PATH}#5"
        )

    def test_get_issue_url(self) -> None:
        assert (
            self.installation.get_issue_url(f"{REPO_PATH}#5") == f"{BASE_URL}/{REPO_PATH}/issues/5"
        )

    def test_get_issue_url_respects_a_sub_path_install(self) -> None:
        self.integration.metadata["base_url"] = "https://example.com/gitea"
        assert (
            self.installation.get_issue_url(f"{REPO_PATH}#5")
            == f"https://example.com/gitea/{REPO_PATH}/issues/5"
        )

    def test_get_persisted_default_config_fields(self) -> None:
        assert self.installation.get_persisted_default_config_fields() == ["repo"]

    @responses.activate
    def test_get_create_issue_config(self) -> None:
        self._mock_repo_search()
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/assignees",
            json=[{"login": "dev"}, {"login": "other"}],
        )
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/labels",
            json=[{"id": 3, "name": "needs-triage"}, {"id": 1, "name": "bug"}],
        )

        fields = {
            field["name"]: field
            for field in self.installation.get_create_issue_config(self.group, self.user)
        }

        assert fields["repo"]["choices"] == [(REPO_PATH, REPO_PATH)]
        assert fields["repo"]["default"] == REPO_PATH
        assert fields["repo"]["url"] == (
            f"/extensions/gitea/search/{self.organization.slug}/{self.installation.model.id}/"
        )
        assert fields["title"]["default"] == "message"
        assert fields["assignee"]["choices"] == [
            ("", "Unassigned"),
            ("dev", "dev"),
            ("other", "other"),
        ]
        # Sorted by name, and keyed by the numeric id Gitea's create payload wants.
        assert fields["labels"]["choices"] == [("1", "bug"), ("3", "needs-triage")]

    @responses.activate
    def test_create_issue(self) -> None:
        responses.add(
            responses.POST,
            f"{API_URL}/repos/{REPO_PATH}/issues",
            json=issue_payload(),
        )

        result = self.installation.create_issue(
            {
                "repo": REPO_PATH,
                "title": "Something broke",
                "description": "A description",
                "assignee": "dev",
                "labels": ["1", "3"],
            }
        )

        assert result == {
            "key": 5,
            "title": "Something broke",
            "description": "A description",
            "url": f"{BASE_URL}/{REPO_PATH}/issues/5",
            "repo": REPO_PATH,
        }
        request = orjson.loads(responses.calls[0].request.body)
        assert request == {
            "title": "Something broke",
            "body": "A description",
            "assignees": ["dev"],
            # Gitea 422s on label names, so the form's string ids are coerced.
            "labels": [1, 3],
        }

    @responses.activate
    def test_create_issue_truncates_a_long_title(self) -> None:
        responses.add(responses.POST, f"{API_URL}/repos/{REPO_PATH}/issues", json=issue_payload())

        self.installation.create_issue(
            {"repo": REPO_PATH, "title": "a" * 300, "description": "A description"}
        )

        title = orjson.loads(responses.calls[0].request.body)["title"]
        assert len(title) == 255
        assert title.endswith("...")

    def test_create_issue_without_a_title(self) -> None:
        with pytest.raises(IntegrationFormError) as excinfo:
            self.installation.create_issue({"repo": REPO_PATH, "description": "A description"})
        assert excinfo.value.field_errors == {"title": "Title is required"}

    def test_create_issue_without_a_repo(self) -> None:
        with pytest.raises(IntegrationFormError) as excinfo:
            self.installation.create_issue({"title": "Something broke"})
        assert excinfo.value.field_errors == {"repo": "Repository is required"}

    def test_create_issue_in_a_repo_the_installation_does_not_have(self) -> None:
        with pytest.raises(IntegrationFormError) as excinfo:
            self.installation.create_issue({"repo": "someone/else", "title": "Something broke"})
        assert excinfo.value.field_errors is not None
        assert "does not belong to this installation" in excinfo.value.field_errors["repo"]

    def test_create_issue_with_a_climbing_repo_path(self) -> None:
        # `repo` is interpolated into `/repos/{repo}/issues`, so a path that
        # climbs would address a different route entirely.
        with pytest.raises(IntegrationFormError) as excinfo:
            self.installation.create_issue({"repo": "../../user", "title": "Something broke"})
        assert excinfo.value.field_errors == {"repo": "Invalid repository name: ../../user"}
        assert len(responses.calls) == 0

    @responses.activate
    def test_create_issue_api_error(self) -> None:
        responses.add(
            responses.POST,
            f"{API_URL}/repos/{REPO_PATH}/issues",
            status=403,
            json={"message": "issues are disabled for this repository"},
        )

        with pytest.raises(IntegrationError) as excinfo:
            self.installation.create_issue(
                {"repo": REPO_PATH, "title": "Something broke", "description": ""}
            )
        assert "issues are disabled for this repository" in str(excinfo.value)

    @responses.activate
    def test_get_link_issue_config(self) -> None:
        self._mock_repo_search()

        fields = {
            field["name"]: field for field in self.installation.get_link_issue_config(self.group)
        }

        assert fields["repo"]["choices"] == [(REPO_PATH, REPO_PATH)]
        assert fields["externalIssue"]["url"] == (
            f"/extensions/gitea/search/{self.organization.slug}/{self.installation.model.id}/"
        )
        assert fields["comment"]["default"] == "Sentry Issue: [{}]({})".format(
            self.group.qualified_short_id,
            absolute_uri(self.group.get_absolute_url(params={"referrer": "gitea_integration"})),
        )

    @responses.activate
    def test_get_issue(self) -> None:
        responses.add(responses.GET, f"{API_URL}/repos/{REPO_PATH}/issues/5", json=issue_payload())

        result = self.installation.get_issue("5", data={"repo": REPO_PATH, "externalIssue": "5"})

        assert result == {
            "key": 5,
            "title": "Something broke",
            "description": "A description",
            "url": f"{BASE_URL}/{REPO_PATH}/issues/5",
            "repo": REPO_PATH,
        }

    def test_get_issue_without_an_issue_number(self) -> None:
        with pytest.raises(IntegrationFormError) as excinfo:
            self.installation.get_issue("", data={"repo": REPO_PATH})
        assert excinfo.value.field_errors == {"externalIssue": "Issue number is required"}

    @responses.activate
    def test_after_link_issue_posts_the_comment(self) -> None:
        responses.add(
            responses.POST,
            f"{API_URL}/repos/{REPO_PATH}/issues/5/comments",
            json={"id": 42, "body": "a comment"},
        )
        external_issue = self.create_integration_external_issue(
            group=self.group, integration=self.integration, key=f"{REPO_PATH}#5"
        )

        self.installation.after_link_issue(external_issue, data={"comment": "a comment"})

        assert orjson.loads(responses.calls[0].request.body) == {"body": "a comment"}

    @responses.activate
    def test_after_link_issue_without_a_comment_is_a_no_op(self) -> None:
        external_issue = self.create_integration_external_issue(
            group=self.group, integration=self.integration, key=f"{REPO_PATH}#5"
        )

        self.installation.after_link_issue(external_issue, data={})

        assert len(responses.calls) == 0

    @responses.activate
    def test_search_issues_filters_out_pull_requests(self) -> None:
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/issues",
            json=[issue_payload()],
        )

        assert self.installation.search_issues("broke", repo=REPO_PATH) == [issue_payload()]

        query = responses.calls[0].request.url.split("?")[1]
        assert "state=open" in query
        # Gitea lists pull requests from the issues endpoint unless told not to.
        assert "type=issues" in query
        assert "q=broke" in query
