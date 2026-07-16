from sentry.seer.agent.embed_widgets import get_embed_widgets
from sentry.testutils.cases import TestCase


class GetEmbedWidgetsTest(TestCase):
    def test_unflagged_widgets_always_included(self) -> None:
        names = {w["name"] for w in get_embed_widgets(self.organization)}
        assert "timestamp" in names

    def test_flagged_widget_excluded_without_flag(self) -> None:
        names = {w["name"] for w in get_embed_widgets(self.organization)}
        assert "todos" not in names

    def test_flagged_widget_included_with_flag(self) -> None:
        with self.feature("organizations:seer-explorer-todos-markdown"):
            names = {w["name"] for w in get_embed_widgets(self.organization)}
        assert "todos" in names

    def test_flagged_widget_excluded_without_organization(self) -> None:
        names = {w["name"] for w in get_embed_widgets(None)}
        assert "timestamp" in names
        assert "todos" not in names
