from sentry.seer.autofix.pr_iteration.out_of_credits import (
    OUT_OF_CREDITS_EXTRA,
    OutOfCredits,
    StrandedAction,
    get_out_of_credits,
    mark_out_of_credits,
    take_out_of_credits,
)
from sentry.testutils.cases import TestCase

RUN_ID = 67890


class OutOfCreditsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )

    def _mark(self, stranded_action: StrandedAction | None = None) -> bool:
        return mark_out_of_credits(
            run_id=RUN_ID, organization_id=self.organization.id, stranded_action=stranded_action
        )

    def _take(self) -> OutOfCredits | None:
        return take_out_of_credits(run_id=RUN_ID, organization_id=self.organization.id)

    def test_take_returns_the_marker_once(self) -> None:
        assert self._take() is None
        assert self._mark(StrandedAction.BRANCH_MOVED_RETRY) is True

        assert self._take() == OutOfCredits(stranded_action=StrandedAction.BRANCH_MOVED_RETRY)
        assert self._take() is None

    def test_mark_keeps_a_recorded_stranded_action(self) -> None:
        self._mark(StrandedAction.PUSH)
        self._mark()

        assert get_out_of_credits(
            run_id=RUN_ID, organization_id=self.organization.id
        ) == OutOfCredits(stranded_action=StrandedAction.PUSH)

    def test_an_unknown_stranded_action_still_marks_the_run(self) -> None:
        self.seer_run.update(extras={OUT_OF_CREDITS_EXTRA: {"stranded_action": "something_new"}})

        assert self._take() == OutOfCredits(stranded_action=None)

    def test_mark_returns_false_for_another_organization(self) -> None:
        other_org = self.create_organization()

        assert (
            mark_out_of_credits(
                run_id=RUN_ID, organization_id=other_org.id, stranded_action=StrandedAction.PUSH
            )
            is False
        )
        assert self._take() is None
