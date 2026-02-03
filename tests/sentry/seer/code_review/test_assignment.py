from sentry.seer.code_review.assignment import is_org_enabled_for_code_review_experiments
from sentry.testutils.cases import TestCase


class CodeReviewExperimentAssignmentTest(TestCase):

    def test_enabled(self) -> None:
        org = self.create_organization(slug="test-org")
        with self.feature("organizations:code-review-experiments-enabled"):
            assert is_org_enabled_for_code_review_experiments(org)

    def test_disabled(self) -> None:
        org = self.create_organization(slug="test-org")
        assert not is_org_enabled_for_code_review_experiments(org)
