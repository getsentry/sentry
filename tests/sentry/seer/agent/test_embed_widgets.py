from typing import Any
from unittest.mock import patch

from sentry.seer.agent.embed_widgets import get_embed_widgets
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature

_FLAG = "organizations:seer-explorer-embeds"
_OTHER_FLAG = "organizations:seer-added"
_TRANSFORMED_QUERY_FLAG = "organizations:seer-explorer-transformed-query-embeds"
_TRANSFORMATION_EXECUTION_FLAG = "organizations:explore-interpolation-and-smoothing"

_UNFLAGGED_WIDGET = {"name": "timestamp", "description": "A timestamp", "level": ["inline"]}
_FLAGGED_WIDGET = {
    "name": "flagged",
    "description": "A widget behind a feature flag.",
    "level": ["block"],
    "featureFlag": _FLAG,
}
_MULTI_FLAGGED_WIDGET = {
    "name": "multi",
    "description": "A widget behind either of two feature flags.",
    "level": ["block"],
    "featureFlag": [_FLAG, _OTHER_FLAG],
}


def transformed_query_widget(name: str) -> dict[str, Any]:
    return {
        "name": name,
        "body": {
            "properties": {
                "yAxes": {"type": "array"},
                "transformations": {"type": "array"},
                "interval": {"type": "string"},
            }
        },
        "examples": [
            {
                "data": {
                    "yAxes": ["count()"],
                    "transformations": [["fill(locf)", "smooth(sma,3)"]],
                    "interval": "5m",
                }
            }
        ],
    }


class GetEmbedWidgetsTest(TestCase):
    @with_feature([_TRANSFORMED_QUERY_FLAG, _TRANSFORMATION_EXECUTION_FLAG])
    def test_generated_query_contract_preserves_axis_transformation_arrays(self) -> None:
        widgets = {
            widget["name"]: widget for widget in get_embed_widgets(self.organization, self.user)
        }

        assert widgets["spansQuery"]["body"]["properties"]["transformations"]["items"] == {
            "type": "array",
            "items": {"type": "string", "minLength": 1},
        }
        assert widgets["logsQuery"]["body"]["properties"]["transformations"]["items"] == {
            "type": "array",
            "items": {"type": "string", "minLength": 1},
        }
        assert widgets["metricsQuery"]["body"]["properties"]["transformations"]["items"] == {
            "type": "array",
            "items": {"type": "string", "minLength": 1},
        }
        assert widgets["metricsQuery"]["body"]["properties"]["interval"]["pattern"] == (
            r"^[1-9]\d*[smhdw]$"
        )

    @with_feature(_TRANSFORMATION_EXECUTION_FLAG)
    def test_transformed_query_fields_wait_for_frontend_rollout(self) -> None:
        definitions = [
            transformed_query_widget(name) for name in ["spansQuery", "logsQuery", "metricsQuery"]
        ]
        with patch("sentry.seer.agent.embed_widgets._WIDGETS", definitions):
            widgets = get_embed_widgets(self.organization, self.user)

        assert [list(widget["body"]["properties"]) for widget in widgets] == [["yAxes"]] * 3
        assert [widget["examples"][0]["data"] for widget in widgets] == [{"yAxes": ["count()"]}] * 3
        assert list(definitions[0]["body"]["properties"]) == [
            "yAxes",
            "transformations",
            "interval",
        ]
        assert definitions[0]["examples"][0]["data"] == {
            "yAxes": ["count()"],
            "transformations": [["fill(locf)", "smooth(sma,3)"]],
            "interval": "5m",
        }

    @with_feature([_TRANSFORMED_QUERY_FLAG, _TRANSFORMATION_EXECUTION_FLAG])
    def test_transformed_query_fields_available_after_rollout(self) -> None:
        definitions = [
            transformed_query_widget(name) for name in ["spansQuery", "logsQuery", "metricsQuery"]
        ]
        with patch("sentry.seer.agent.embed_widgets._WIDGETS", definitions):
            widgets = get_embed_widgets(self.organization, self.user)

        assert widgets == definitions
        assert widgets[0]["examples"][0]["data"] == {
            "yAxes": ["count()"],
            "transformations": [["fill(locf)", "smooth(sma,3)"]],
            "interval": "5m",
        }

    @with_feature(_TRANSFORMED_QUERY_FLAG)
    def test_transformed_query_fields_require_execution_support(self) -> None:
        with patch(
            "sentry.seer.agent.embed_widgets._WIDGETS", [transformed_query_widget("spansQuery")]
        ):
            widgets = get_embed_widgets(self.organization, self.user)

        assert widgets[0]["body"]["properties"] == {"yAxes": {"type": "array"}}
        assert widgets[0]["examples"][0]["data"] == {"yAxes": ["count()"]}

    @with_feature([_TRANSFORMED_QUERY_FLAG, _TRANSFORMATION_EXECUTION_FLAG])
    def test_transformed_query_fields_require_an_organization(self) -> None:
        with patch(
            "sentry.seer.agent.embed_widgets._WIDGETS", [transformed_query_widget("spansQuery")]
        ):
            widgets = get_embed_widgets()

        assert widgets[0]["body"]["properties"] == {"yAxes": {"type": "array"}}
        assert widgets[0]["examples"][0]["data"] == {"yAxes": ["count()"]}

    def test_no_flags_returns_all_widgets(self) -> None:
        with patch(
            "sentry.seer.agent.embed_widgets._WIDGETS",
            [_UNFLAGGED_WIDGET],
        ):
            widgets = get_embed_widgets(self.organization, self.user)

        assert widgets == [_UNFLAGGED_WIDGET]

    def test_flagged_widget_excluded_without_flag(self) -> None:
        with patch(
            "sentry.seer.agent.embed_widgets._WIDGETS",
            [_UNFLAGGED_WIDGET, _FLAGGED_WIDGET],
        ):
            widgets = get_embed_widgets(self.organization, self.user)

        names = {w["name"] for w in widgets}
        assert names == {"timestamp"}

    @with_feature(_FLAG)
    def test_flagged_widget_included_with_flag(self) -> None:
        with patch(
            "sentry.seer.agent.embed_widgets._WIDGETS",
            [_UNFLAGGED_WIDGET, _FLAGGED_WIDGET],
        ):
            widgets = get_embed_widgets(self.organization, self.user)

        names = {w["name"] for w in widgets}
        assert names == {"timestamp", "flagged"}

    @with_feature(_FLAG)
    def test_flagged_widget_excluded_without_organization(self) -> None:
        # A widget's flag can't be evaluated without an org, so it is dropped even
        # when the flag would otherwise be enabled.
        with patch(
            "sentry.seer.agent.embed_widgets._WIDGETS",
            [_UNFLAGGED_WIDGET, _FLAGGED_WIDGET],
        ):
            widgets = get_embed_widgets(organization=None)

        names = {w["name"] for w in widgets}
        assert names == {"timestamp"}

    def test_multi_flagged_widget_excluded_without_any_flag(self) -> None:
        with patch(
            "sentry.seer.agent.embed_widgets._WIDGETS",
            [_UNFLAGGED_WIDGET, _MULTI_FLAGGED_WIDGET],
        ):
            widgets = get_embed_widgets(self.organization, self.user)

        names = {w["name"] for w in widgets}
        assert names == {"timestamp"}

    @with_feature(_OTHER_FLAG)
    def test_multi_flagged_widget_included_with_one_flag(self) -> None:
        # Any one flag in the list is enough: an org holds whichever flag its
        # plan grants, never the whole list.
        with patch(
            "sentry.seer.agent.embed_widgets._WIDGETS",
            [_UNFLAGGED_WIDGET, _MULTI_FLAGGED_WIDGET],
        ):
            widgets = get_embed_widgets(self.organization, self.user)

        names = {w["name"] for w in widgets}
        assert names == {"timestamp", "multi"}

    def test_autofix_widgets_excluded_without_a_seer_plan(self) -> None:
        names = {w["name"] for w in get_embed_widgets(self.organization, self.user)}

        assert not names & {"autofix", "autofixRef"}

    def test_autofix_widgets_included_for_each_seer_plan(self) -> None:
        for plan_flag in (
            "organizations:seat-based-seer-enabled",
            "organizations:seer-added",
            "organizations:token-billed-seer-enabled",
        ):
            with self.subTest(plan_flag=plan_flag), self.feature(plan_flag):
                names = {w["name"] for w in get_embed_widgets(self.organization, self.user)}

                assert {"autofix", "autofixRef"} <= names
