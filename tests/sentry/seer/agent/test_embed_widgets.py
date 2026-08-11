from unittest.mock import patch

from sentry.seer.agent.embed_widgets import get_embed_widgets
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature

_UNFLAGGED_WIDGET = {"name": "timestamp", "description": "A timestamp", "level": ["inline"]}
_FLAGGED_WIDGET = {
    "name": "autofix",
    "description": "The result of an Autofix step/action.",
    "level": ["block"],
    "featureFlag": "organizations:seer-agent-autofix",
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

    @with_feature("organizations:seer-agent-autofix")
    def test_flagged_widget_included_with_flag(self):
        with patch(
            "sentry.seer.agent.embed_widgets._WIDGETS",
            [_UNFLAGGED_WIDGET, _FLAGGED_WIDGET],
        ):
            widgets = get_embed_widgets(self.organization, self.user)

        names = {w["name"] for w in widgets}
        assert names == {"timestamp", "autofix"}

    @with_feature("organizations:seer-agent-autofix")
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
