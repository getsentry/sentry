from sentry import options
from sentry.seer.code_review.assignment import get_code_review_experiment
from sentry.testutils.cases import TestCase


class CodeReviewExperimentAssignmentTest(TestCase):
    def test_single_experiment_gets_all_traffic(self) -> None:
        """Single experiment with any positive weight gets 100% of traffic."""
        org = self.create_organization(slug="test-org")
        options.set("code-review.experiments", [["test-exp", 1]])

        with self.feature("organizations:code-review-experiments-enabled"):
            # Test multiple PRs - all should get the experiment
            for pr_id in range(10):
                result = get_code_review_experiment(org, pr_id=str(pr_id))
                assert result == "test-exp"

    def test_disabled_experiment(self) -> None:
        """Weight 0 means experiment is disabled."""
        org = self.create_organization(slug="test-org")
        options.set("code-review.experiments", [["test-exp", 0]])

        with self.feature("organizations:code-review-experiments-enabled"):
            for pr_id in range(10):
                result = get_code_review_experiment(org, pr_id=str(pr_id))
                assert result == "baseline"

    def test_empty_experiments_list(self) -> None:
        """Empty list means all PRs get baseline."""
        org = self.create_organization(slug="test-org")
        options.set("code-review.experiments", [])

        with self.feature("organizations:code-review-experiments-enabled"):
            result = get_code_review_experiment(org, pr_id="123")
            assert result == "baseline"

    def test_equal_weights_split_traffic(self) -> None:
        """Equal weights split traffic proportionally."""
        org = self.create_organization(slug="test-org")
        options.set(
            "code-review.experiments",
            [
                ["exp-1", 1],
                ["exp-2", 1],
            ],
        )

        with self.feature("organizations:code-review-experiments-enabled"):
            results = {"exp-1": 0, "exp-2": 0, "baseline": 0}

            # Test 100 PRs to see distribution
            for pr_id in range(100):
                result = get_code_review_experiment(org, pr_id=str(pr_id))
                results[result] += 1

            # Should have both experiments represented, no baseline
            assert results["exp-1"] > 0
            assert results["exp-2"] > 0
            assert results["baseline"] == 0

    def test_deterministic_per_pr_assignment(self) -> None:
        """Same PR always gets same result (deterministic hashing)."""
        org = self.create_organization(slug="test-org")
        options.set("code-review.experiments", [["exp-a", 1], ["exp-b", 1]])

        with self.feature("organizations:code-review-experiments-enabled"):
            # Call multiple times with same PR ID
            result1 = get_code_review_experiment(org, pr_id="123")
            result2 = get_code_review_experiment(org, pr_id="123")
            result3 = get_code_review_experiment(org, pr_id="123")

            # All results should be identical
            assert result1 == result2 == result3

    def test_variable_assignment_across_prs(self) -> None:
        """Different PRs from same org can get different assignments."""
        org = self.create_organization(slug="test-org")
        options.set("code-review.experiments", [["exp-a", 1], ["exp-b", 1]])

        with self.feature("organizations:code-review-experiments-enabled"):
            results = set()
            for pr_id in range(100):
                result = get_code_review_experiment(org, pr_id=str(pr_id))
                results.add(result)

            # With equal weights, should see both experiments
            assert "exp-a" in results
            assert "exp-b" in results

    def test_org_not_eligible_always_baseline(self) -> None:
        """Orgs without flag enabled always get baseline."""
        org = self.create_organization(slug="not-eligible")
        options.set("code-review.experiments", [["test-exp", 1]])

        # Feature flag NOT enabled for this org
        result = get_code_review_experiment(org, pr_id="123")
        assert result == "baseline"

    def test_weighted_distribution(self) -> None:
        """Weights determine proportional distribution of traffic."""
        org = self.create_organization(slug="test-org")
        options.set(
            "code-review.experiments",
            [
                ["exp-1", 0],  # Disabled - skip
                ["exp-2", 3],  # 3 parts
                ["exp-3", 2],  # 2 parts
                ["exp-4", 1],  # 1 part
            ],
        )
        # Total weight: 6, so exp-2: 50%, exp-3: 33%, exp-4: 17%

        with self.feature("organizations:code-review-experiments-enabled"):
            results = {"baseline": 0, "exp-1": 0, "exp-2": 0, "exp-3": 0, "exp-4": 0}

            # Test 1000 PRs to get distribution
            for pr_id in range(1000):
                result = get_code_review_experiment(org, pr_id=str(pr_id))
                results[result] += 1

            # exp-1 disabled, should get 0
            assert results["exp-1"] == 0

            # Weights should be proportional: exp-2 > exp-3 > exp-4
            assert results["exp-2"] > results["exp-3"] > results["exp-4"]

            # All experiments should have some traffic
            assert results["exp-2"] > 0
            assert results["exp-3"] > 0
            assert results["exp-4"] > 0

            # No baseline since all weights add up to 100%
            assert results["baseline"] == 0

    def test_user_parameter_optional(self) -> None:
        """User parameter is optional for assignment."""
        org = self.create_organization(slug="test-org")
        options.set("code-review.experiments", [["test-exp", 1]])

        with self.feature("organizations:code-review-experiments-enabled"):
            # Should work without user
            result = get_code_review_experiment(org, pr_id="123", user=None)
            assert result == "test-exp"
