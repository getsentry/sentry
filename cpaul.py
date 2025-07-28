from unittest.mock import patch

from sentry.models.release import Release


@patch.object("sentry.workflow_engine.migration_helpers.rule_action.logger.error")
def test_foo(mock_err):
    pass


@patch("sentry.workflow_engine.migration_helpers.rule_action.logger.error")
def test_foo_with_return(mock_err) -> None:
    pass


class BarTests:

    @patch("sentry.workflow_engine.processors.workflow.evaluate_workflow_triggers")
    def test_bar(self, mock_triggers):
        pass

    @patch("sentry.search.utils.get_latest_release")
    @patch.object(Release.objects, "get", return_value=None)
    def test_baz(self, mock_get_latest_release, mock_get):
        pass
