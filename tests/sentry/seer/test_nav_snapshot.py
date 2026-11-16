from collections.abc import Iterator
from typing import Any
from unittest import mock

import pytest
from django.test import override_settings

from sentry.seer import nav_snapshot
from sentry.seer.nav_snapshot import (
    describe_condition,
    get_nav_snapshot,
    resolve_condition,
    visible_nav_links,
)

LOGS = {"flag": "ourlogs-enabled"}
OPEN_MEMBERSHIP = {"org": "openMembership"}


def test_get_nav_snapshot() -> None:
    snapshot = get_nav_snapshot()
    assert snapshot["version"] == 1
    assert snapshot["entries"]
    for entry in snapshot["entries"]:
        assert entry["crumbs"]
        assert entry["path"].startswith("/")


def _snapshot(*entries: dict[str, Any]) -> Any:
    return mock.patch.object(nav_snapshot, "_SNAPSHOT", {"version": 1, "entries": list(entries)})


class TestResolveCondition:
    def test_flags_decide(self) -> None:
        features = {"ourlogs-enabled"}
        assert resolve_condition(LOGS, features, set()) is True
        assert resolve_condition({"not": LOGS}, features, set()) is False
        assert resolve_condition({"flag": "other"}, features, set()) is False

    def test_all_keeps_only_undecided_parts(self) -> None:
        cond = {"all": [{"flag": "investigations"}, OPEN_MEMBERSHIP]}
        assert resolve_condition(cond, {"investigations"}, set()) == OPEN_MEMBERSHIP

    def test_any_short_circuits_on_known_true(self) -> None:
        assert resolve_condition({"any": [{"flag": "a"}, {"unknown": "x()"}]}, {"a"}, set()) is True
        assert resolve_condition({"any": [{"flag": "b"}, {"unknown": "x()"}]}, {"a"}, set()) == {
            "unknown": "x()"
        }

    @override_settings(SENTRY_SELF_HOSTED=False, SENTRY_SELF_HOSTED_ERRORS_ONLY=False)
    def test_saas_is_not_self_hosted(self) -> None:
        assert resolve_condition({"deployment": "self_hosted"}, set(), set()) is False
        assert resolve_condition({"not": {"deployment": "self_hosted"}}, set(), set()) is True
        assert resolve_condition({"deployment": "self_hosted_errors_only"}, set(), set()) is False

    @override_settings(SENTRY_SELF_HOSTED=True, SENTRY_SELF_HOSTED_ERRORS_ONLY=True)
    def test_self_hosted_errors_only(self) -> None:
        assert resolve_condition({"deployment": "self_hosted"}, set(), set()) is True
        assert resolve_condition({"deployment": "self_hosted_errors_only"}, set(), set()) is True

    def test_org_setting_is_left_pending(self) -> None:
        assert resolve_condition(OPEN_MEMBERSHIP, set(), set()) == OPEN_MEMBERSHIP

    def test_scopes_decide(self) -> None:
        billing = {"scope": "org:billing"}
        assert resolve_condition(billing, set(), {"org:billing"}) is True
        assert resolve_condition(billing, set(), {"org:read"}) is False

    def test_describe(self) -> None:
        assert describe_condition({"all": [LOGS, {"not": OPEN_MEMBERSHIP}]}) == (
            "feature `ourlogs-enabled` enabled and not organization setting `openMembership` enabled"
        )
        assert describe_condition({"scope": "org:billing"}) == (
            "the user has the `org:billing` permission"
        )


class TestVisibleNavLinks:
    @pytest.fixture(autouse=True)
    def snapshot(self) -> Iterator[None]:
        with _snapshot(
            {"crumbs": "Explore → Logs", "path": "/explore/logs/", "when": LOGS},
            {"crumbs": "Explore → Releases", "path": "/explore/releases/"},
            {
                "crumbs": "Explore → Investigations",
                "path": "/explore/investigations/",
                "when": {"all": [{"flag": "investigations"}, OPEN_MEMBERSHIP]},
            },
            {"crumbs": "Settings → Organization → Teams", "path": "/settings/teams/"},
            {
                "crumbs": "Settings → Organization → Teams → <team> → Members",
                "path": "/settings/teams/{team_slug}/members/",
                "sub_page": True,
            },
        ):
            yield

    def test_drops_pages_org_cannot_see_and_annotates_undecided(self) -> None:
        visible = {
            link.crumbs: link.pending for link in visible_nav_links({"investigations"}, set())
        }
        assert visible == {
            "Explore → Releases": None,
            "Explore → Investigations": OPEN_MEMBERSHIP,
            "Settings → Organization → Teams": None,
        }

    def test_section_scope_includes_sub_pages(self) -> None:
        assert [link.crumbs for link in visible_nav_links(set(), set(), section="settings")] == [
            "Settings → Organization → Teams",
            "Settings → Organization → Teams → <team> → Members",
        ]

    def test_section_is_case_insensitive(self) -> None:
        assert [link.crumbs for link in visible_nav_links(set(), set(), section="Explore")] == [
            "Explore → Releases",
        ]

    def test_unknown_section_falls_back_to_everything_without_sub_pages(self) -> None:
        assert [link.crumbs for link in visible_nav_links(set(), set(), section="nope")] == [
            "Explore → Releases",
            "Settings → Organization → Teams",
        ]


def test_pages_with_unreadable_conditions_are_left_out() -> None:
    unknown = {"unknown": "hasTempestAccess(organization)"}
    with _snapshot(
        {"crumbs": "Settings → PlayStation", "path": "/a/", "when": unknown},
        {"crumbs": "Settings → Negated", "path": "/b/", "when": {"not": unknown}},
        {
            "crumbs": "Settings → Subscription",
            "path": "/c/",
            "when": {"any": [OPEN_MEMBERSHIP, {"unknown": "membersCanViewSubscriptionInfo"}]},
        },
        {"crumbs": "Settings → Logs or unknown", "path": "/d/", "when": {"any": [LOGS, unknown]}},
        {"crumbs": "Settings → Logs and unknown", "path": "/e/", "when": {"all": [LOGS, unknown]}},
    ):
        visible = {
            link.crumbs: link.pending for link in visible_nav_links({"ourlogs-enabled"}, set())
        }
    assert visible == {
        # A readable alternative keeps the page, with only that alternative as the condition.
        "Settings → Subscription": OPEN_MEMBERSHIP,
        # A known-true alternative decides the page outright.
        "Settings → Logs or unknown": None,
    }
