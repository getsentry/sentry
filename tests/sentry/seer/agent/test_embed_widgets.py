from unittest.mock import patch

from sentry.seer.agent.embed_widgets import get_embed_widgets
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature

_FLAG = "organizations:seer-explorer-embeds"
_OTHER_FLAG = "organizations:seer-added"

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


class GetEmbedWidgetsTest(TestCase):
    def test_no_flags_returns_all_widgets(self):
        with patch(
            "sentry.seer.agent.embed_widgets._WIDGETS",
            [_UNFLAGGED_WIDGET],
        ):
            widgets = get_embed_widgets(self.organization, self.user)

        assert widgets == [_UNFLAGGED_WIDGET]

    def test_flagged_widget_excluded_without_flag(self):
        with patch(
            "sentry.seer.agent.embed_widgets._WIDGETS",
            [_UNFLAGGED_WIDGET, _FLAGGED_WIDGET],
        ):
            widgets = get_embed_widgets(self.organization, self.user)

        names = {w["name"] for w in widgets}
        assert names == {"timestamp"}

    @with_feature(_FLAG)
    def test_flagged_widget_included_with_flag(self):
        with patch(
            "sentry.seer.agent.embed_widgets._WIDGETS",
            [_UNFLAGGED_WIDGET, _FLAGGED_WIDGET],
        ):
            widgets = get_embed_widgets(self.organization, self.user)

        names = {w["name"] for w in widgets}
        assert names == {"timestamp", "flagged"}

    @with_feature(_FLAG)
    def test_flagged_widget_excluded_without_organization(self):
        # A widget's flag can't be evaluated without an org, so it is dropped even
        # when the flag would otherwise be enabled.
        with patch(
            "sentry.seer.agent.embed_widgets._WIDGETS",
            [_UNFLAGGED_WIDGET, _FLAGGED_WIDGET],
        ):
            widgets = get_embed_widgets(organization=None)

        names = {w["name"] for w in widgets}
        assert names == {"timestamp"}

    def test_multi_flagged_widget_excluded_without_any_flag(self):
        with patch(
            "sentry.seer.agent.embed_widgets._WIDGETS",
            [_UNFLAGGED_WIDGET, _MULTI_FLAGGED_WIDGET],
        ):
            widgets = get_embed_widgets(self.organization, self.user)

        names = {w["name"] for w in widgets}
        assert names == {"timestamp"}

    @with_feature(_OTHER_FLAG)
    def test_multi_flagged_widget_included_with_one_flag(self):
        # Any one flag in the list is enough: an org holds whichever flag its
        # plan grants, never the whole list.
        with patch(
            "sentry.seer.agent.embed_widgets._WIDGETS",
            [_UNFLAGGED_WIDGET, _MULTI_FLAGGED_WIDGET],
        ):
            widgets = get_embed_widgets(self.organization, self.user)

        names = {w["name"] for w in widgets}
        assert names == {"timestamp", "multi"}
