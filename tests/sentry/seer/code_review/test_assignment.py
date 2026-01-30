from sentry import options
from sentry.seer.code_review.assignment import get_code_review_experiment
from sentry.testutils.cases import TestCase


class CodeReviewExperimentAssignmentTest(TestCase):
    def test_fully_released_experiment(self):
        """Rollout 1.0 means all PRs get the experiment."""
        org = self.create_organization(slug="test-org")
        options.set("bug-prediction.experiments", [["test-exp", 1.0]])

        with self.feature("organizations:code-review-experiments-enabled"):
            # Test multiple PRs - all should get the experiment
            for pr_id in range(10):
                result = get_code_review_experiment(org, pr_id=str(pr_id))
                assert result == "test-exp"

    def test_disabled_experiment(self):
        """Rollout 0.0 means no PRs get the experiment."""
        org = self.create_organization(slug="test-org")
        options.set("bug-prediction.experiments", [["test-exp", 0.0]])

        with self.feature("organizations:code-review-experiments-enabled"):
            for pr_id in range(10):
                result = get_code_review_experiment(org, pr_id=str(pr_id))
                assert result == "baseline"

    def test_empty_experiments_list(self):
        """Empty list means all PRs get baseline."""
        org = self.create_organization(slug="test-org")
        options.set("bug-prediction.experiments", [])

        with self.feature("organizations:code-review-experiments-enabled"):
            result = get_code_review_experiment(org, pr_id="123")
            assert result == "baseline"

    def test_first_match_wins(self):
        """When multiple experiments could match, first one wins."""
        org = self.create_organization(slug="test-org")
        options.set(
            "bug-prediction.experiments",
            [
                ["exp-1", 1.0],  # This will always match first
                ["exp-2", 1.0],
            ],
        )

        with self.feature("organizations:code-review-experiments-enabled"):
            result = get_code_review_experiment(org, pr_id="123")
            assert result == "exp-1"  # First match wins

    def test_deterministic_per_pr_assignment(self):
        """Same PR always gets same result (deterministic hashing)."""
        org = self.create_organization(slug="test-org")
        options.set("bug-prediction.experiments", [["test-exp", 0.5]])

        with self.feature("organizations:code-review-experiments-enabled"):
            # Call multiple times with same PR ID
            result1 = get_code_review_experiment(org, pr_id="123")
            result2 = get_code_review_experiment(org, pr_id="123")
            result3 = get_code_review_experiment(org, pr_id="123")

            # All results should be identical
            assert result1 == result2 == result3

    def test_variable_assignment_across_prs(self):
        """Different PRs from same org can get different assignments."""
        org = self.create_organization(slug="test-org")
        options.set("bug-prediction.experiments", [["test-exp", 0.5]])

        with self.feature("organizations:code-review-experiments-enabled"):
            results = set()
            for pr_id in range(100):
                result = get_code_review_experiment(org, pr_id=str(pr_id))
                results.add(result)

            # With 50% rollout and 100 PRs, should see both outcomes
            assert "baseline" in results
            assert "test-exp" in results

    def test_org_not_eligible_always_baseline(self):
        """Orgs without flag enabled always get baseline."""
        org = self.create_organization(slug="not-eligible")
        options.set("bug-prediction.experiments", [["test-exp", 1.0]])

        # Feature flag NOT enabled for this org
        result = get_code_review_experiment(org, pr_id="123")
        assert result == "baseline"

    def test_multiple_experiments_cascading(self):
        """Multiple experiments evaluated in order until match."""
        org = self.create_organization(slug="test-org")
        options.set(
            "bug-prediction.experiments",
            [
                ["exp-1", 0.0],  # Disabled - skip
                ["exp-2", 0.3],  # 30% of PRs
                ["exp-3", 0.5],  # 50% of remaining PRs
            ],
        )

        with self.feature("organizations:code-review-experiments-enabled"):
            results = {"baseline": 0, "exp-2": 0, "exp-3": 0}

            # Test 1000 PRs to get distribution
            for pr_id in range(1000):
                result = get_code_review_experiment(org, pr_id=str(pr_id))
                results[result] += 1

            # Should have all three outcomes
            assert results["exp-2"] > 0  # Some get exp-2
            assert results["exp-3"] > 0  # Some get exp-3
            assert results["baseline"] > 0  # Some get baseline

    def test_user_parameter_optional(self):
        """User parameter is optional for assignment."""
        org = self.create_organization(slug="test-org")
        options.set("bug-prediction.experiments", [["test-exp", 1.0]])

        with self.feature("organizations:code-review-experiments-enabled"):
            # Should work without user
            result = get_code_review_experiment(org, pr_id="123", user=None)
            assert result == "test-exp"
