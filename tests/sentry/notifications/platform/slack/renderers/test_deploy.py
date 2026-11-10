from __future__ import annotations

from typing import Any

import pytest

from sentry.notifications.platform.slack.provider import (
    SLACK_MAX_BLOCKS,
    SlackNotificationProvider,
    SlackRenderable,
)
from sentry.notifications.platform.slack.renderers.deploy import (
    MAX_LISTED_COMMITS_PER_REPO,
    MAX_LISTED_PROJECTS,
    SlackDeployReleaseRenderer,
)
from sentry.notifications.platform.templates.deploy import (
    DeployReleaseCommit,
    DeployReleaseData,
    DeployReleaseProject,
    DeployReleaseTemplate,
)
from sentry.notifications.platform.tracking import NotificationLinkDecorator
from sentry.notifications.platform.types import NotificationProviderKey
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import MockNotification


def _project(i: int) -> DeployReleaseProject:
    return {
        "project_slug": f"project-{i}",
        "release_url": f"https://sentry.io/organizations/acme/releases/1.0.0/?project={i}",
        "resolved_issue_count": 0,
    }


def _commit(i: int, message: str | None = None) -> DeployReleaseCommit:
    return {
        "author_name": "alice",
        "date": "2026-01-01T06:00:40+00:00",
        "sha": f"{i:07x}",
        "message": message or f"fix: change {i}",
    }


def _make_data(**overrides: Any) -> DeployReleaseData:
    return DeployReleaseTemplate.example_data.copy(update=overrides)


def _render(data: DeployReleaseData) -> SlackRenderable:
    return SlackDeployReleaseRenderer.render(
        data=data,
        rendered_template=DeployReleaseTemplate().render(data),
        link_decorator=NotificationLinkDecorator(data=data, provider=NotificationProviderKey.SLACK),
    )


def _texts(renderable: SlackRenderable) -> list[str]:
    return [
        block.to_dict()["text"]["text"]
        for block in renderable["blocks"]
        if block.to_dict()["type"] == "section"
    ]


class SlackDeployReleaseRendererTest(TestCase):
    def test_provider_uses_deploy_renderer(self) -> None:
        assert (
            SlackNotificationProvider.get_renderer(data=_make_data()) is SlackDeployReleaseRenderer
        )

    def test_rejects_other_data(self) -> None:
        data = MockNotification(message="test")
        with pytest.raises(ValueError):
            SlackDeployReleaseRenderer.render(
                data=data,
                rendered_template=DeployReleaseTemplate().render_example(),
                link_decorator=NotificationLinkDecorator(
                    data=data, provider=NotificationProviderKey.SLACK
                ),
            )

    def test_groups_lists_into_one_section_each(self) -> None:
        texts = _texts(_render(_make_data()))

        assert texts[2] == (
            "*Projects:*\n"
            "backend ( <https://sentry.io/organizations/acme/releases/v1.0.0/?project=1|View Release> ) resolving 2 issues.\n"
            "frontend ( <https://sentry.io/organizations/acme/releases/v1.0.0/?project=1|View Release> ) resolving 4 issues."
        )
        assert texts[3] == "*Repositories:*"
        assert texts[4].startswith("*getsentry/sentry*\nfix(auth): correct oauth redirect url")
        assert texts[4].count("\n") == 3
        assert texts[5].startswith("*getsentry/getsentry*\nfix(platform): undo bob's sorting")

    def test_caps_each_list_and_counts_what_was_cut(self) -> None:
        renderable = _render(
            _make_data(
                release_projects=[_project(i) for i in range(MAX_LISTED_PROJECTS + 5)],
                repo_name_to_commits={
                    "getsentry/sentry": [
                        _commit(i) for i in range(MAX_LISTED_COMMITS_PER_REPO + 30)
                    ],
                    "getsentry/getsentry": [_commit(i) for i in range(2)],
                },
            )
        )
        texts = _texts(renderable)

        assert texts[2].count("\n") == MAX_LISTED_PROJECTS + 1
        assert texts[2].endswith("\n_…and 5 more projects_")
        assert texts[4].count("\n") == MAX_LISTED_COMMITS_PER_REPO + 1
        assert texts[4].endswith("\n_…and 30 more commits_")
        assert "more" not in texts[5]

    def test_cuts_whole_lines_to_fit_section_text_limit(self) -> None:
        long_message = "x" * 900
        renderable = _render(
            _make_data(
                repo_name_to_commits={
                    "getsentry/sentry": [_commit(i, long_message) for i in range(5)]
                }
            )
        )
        text = _texts(renderable)[4]

        assert len(text) <= 3000
        assert text.endswith("\n_…and 2 more commits_")
        assert text.count(long_message) == 3

    def test_many_repos_stay_within_block_limit(self) -> None:
        renderable = _render(
            _make_data(
                repo_name_to_commits={f"getsentry/repo-{i}": [_commit(i)] for i in range(60)}
            )
        )

        assert len(renderable["blocks"]) == SLACK_MAX_BLOCKS

    def test_no_commits_shows_connect_repository_prompt(self) -> None:
        renderable = _render(_make_data(repo_name_to_commits={}))

        assert _texts(renderable)[-1].startswith("_Deploys are better with commit data.")
        assert renderable["blocks"][-2].to_dict()["type"] == "actions"
