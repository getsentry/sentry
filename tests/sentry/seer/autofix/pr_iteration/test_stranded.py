from sentry.seer.autofix.pr_iteration.stranded import (
    STRANDED_EXTRA,
    StrandedAction,
    record_stranded_action,
    take_stranded_action,
)
from sentry.testutils.cases import TestCase

RUN_ID = 67890


class StrandedActionTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )

    def _take(self) -> StrandedAction | None:
        return take_stranded_action(run_id=RUN_ID, organization_id=self.organization.id)

    def test_stranded_action_is_taken_once(self) -> None:
        assert (
            record_stranded_action(
                run_id=RUN_ID,
                organization_id=self.organization.id,
                stranded_action=StrandedAction.BRANCH_MOVED_RETRY,
            )
            is True
        )

        assert self._take() == StrandedAction.BRANCH_MOVED_RETRY
        assert self._take() is None

    def test_returns_none_when_nothing_is_stranded(self) -> None:
        assert self._take() is None

    def test_returns_none_for_an_unknown_action(self) -> None:
        self.seer_run.update(extras={STRANDED_EXTRA: {"action": "something_new"}})

        assert self._take() is None

    def test_record_returns_false_for_another_organization(self) -> None:
        other_org = self.create_organization()

        assert (
            record_stranded_action(
                run_id=RUN_ID, organization_id=other_org.id, stranded_action=StrandedAction.PUSH
            )
            is False
        )
        assert self._take() is None
