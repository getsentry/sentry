from sentry.issues.derived.gate import (
    GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION,
    derived_should_be_correct,
    is_backfilled,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class IsBackfilledTest(TestCase):
    def test_true(self) -> None:
        self.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, True)

        assert is_backfilled(self.project) is True

    def test_false(self) -> None:
        self.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, False)

        assert is_backfilled(self.project) is False

    def test_missing(self) -> None:
        assert is_backfilled(self.project) is False


class DerivedShouldBeCorrectTest(TestCase):
    @with_feature("projects:issue-action-log-write-to-db")
    def test_backfilled_with_writes_enabled(self) -> None:
        self.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, True)

        assert derived_should_be_correct(self.project) is True

    @with_feature("projects:issue-action-log-write-to-db")
    def test_not_backfilled(self) -> None:
        assert derived_should_be_correct(self.project) is False

    def test_writes_disabled(self) -> None:
        self.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, True)

        assert derived_should_be_correct(self.project) is False
