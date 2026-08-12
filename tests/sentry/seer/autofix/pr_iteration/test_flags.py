from sentry.seer.autofix.pr_iteration.constants import (
    AUTOMATED_FLAG,
    CAP_ASSIGN_FLAG,
    MANUAL_FLAG,
    PR_ITERATION_PROJECT_FLAG,
    REVIEW_REQUEST_FLAG,
)
from sentry.seer.autofix.pr_iteration.flags import (
    STAGE_ORG_FLAGS,
    PrIterationStage,
    has_pr_iteration_flag,
)
from sentry.testutils.cases import TestCase

ALL_ORG_FLAGS = [AUTOMATED_FLAG, MANUAL_FLAG, REVIEW_REQUEST_FLAG, CAP_ASSIGN_FLAG]


class HasPrIterationFlagTest(TestCase):
    def test_every_stage_is_mapped_to_an_org_flag(self) -> None:
        assert set(STAGE_ORG_FLAGS) == set(PrIterationStage)

    def test_org_flag_alone_does_not_enable_a_stage(self) -> None:
        # The project has not opted into PR iteration, so no org rollout reaches it.
        with self.feature(ALL_ORG_FLAGS):
            for stage in PrIterationStage:
                with self.subTest(stage=stage.value):
                    assert has_pr_iteration_flag(stage, self.project) is False

    def test_project_flag_alone_does_not_enable_a_stage(self) -> None:
        with self.feature(PR_ITERATION_PROJECT_FLAG):
            for stage in PrIterationStage:
                with self.subTest(stage=stage.value):
                    assert has_pr_iteration_flag(stage, self.project) is False

    def test_both_flags_enable_the_stage(self) -> None:
        for stage in PrIterationStage:
            with self.subTest(stage=stage.value):
                with self.feature([PR_ITERATION_PROJECT_FLAG, STAGE_ORG_FLAGS[stage]]):
                    assert has_pr_iteration_flag(stage, self.project) is True

    def test_manual_implies_automated(self) -> None:
        # An org that rolled out manual iteration gets automated iteration too,
        # without having to also enable the automated flag.
        with self.feature([PR_ITERATION_PROJECT_FLAG, MANUAL_FLAG]):
            assert has_pr_iteration_flag(PrIterationStage.AUTOMATED, self.project) is True

    def test_manual_implication_still_requires_the_project_flag(self) -> None:
        with self.feature(MANUAL_FLAG):
            assert has_pr_iteration_flag(PrIterationStage.AUTOMATED, self.project) is False

    def test_automated_does_not_imply_manual(self) -> None:
        # The implication is one-directional: automated CI iteration must not
        # open the human-triggered surfaces.
        with self.feature([PR_ITERATION_PROJECT_FLAG, AUTOMATED_FLAG]):
            assert has_pr_iteration_flag(PrIterationStage.MANUAL, self.project) is False

    def test_manual_does_not_imply_the_unrelated_stages(self) -> None:
        with self.feature([PR_ITERATION_PROJECT_FLAG, MANUAL_FLAG]):
            assert has_pr_iteration_flag(PrIterationStage.REVIEW, self.project) is False
            assert has_pr_iteration_flag(PrIterationStage.HARD_CAP, self.project) is False
