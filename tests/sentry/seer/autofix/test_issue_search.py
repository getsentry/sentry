from datetime import timedelta

from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.seer.autofix.issue_search import autofix_state_filter
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType

RECENCY_WINDOW = timedelta(days=30)


class AutofixStateFilterTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group1 = self.create_group(project=self.project)
        self.group2 = self.create_group(project=self.project)

    def _matching_group_ids(self, values: list[str]) -> set[int]:
        q = autofix_state_filter(values, [self.project], recency_window=RECENCY_WINDOW)
        from sentry.models.group import Group

        return set(Group.objects.filter(q, project=self.project).values_list("id", flat=True))

    def _create_merged_pr_run(self, group):
        run = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(run, source="autofix", project=self.project, group=group)
        repo = self.create_repo(self.project, name="getsentry/sentry")
        pr = self.create_pull_request(
            repository_id=repo.id, organization_id=self.organization.id, key="101"
        )
        pr.update(state=PullRequestLifecycleState.MERGED, merged_at=timezone.now())
        self.create_seer_run_pull_request(run, pr)

    def test_milestones_are_exclusive(self) -> None:
        self.create_group_activity(
            group=self.group1, type=ActivityType.SEER_SOLUTION_COMPLETED.value
        )
        self.create_group_activity(group=self.group1, type=ActivityType.SEER_CODING_COMPLETED.value)
        self.create_group_activity(
            group=self.group2, type=ActivityType.SEER_SOLUTION_COMPLETED.value
        )

        assert self._matching_group_ids(["code_changes_ready"]) == {self.group1.id}
        assert self._matching_group_ids(["solution_ready"]) == {self.group2.id}

    def test_review_pr_excludes_merged(self) -> None:
        self.create_group_activity(group=self.group1, type=ActivityType.SEER_PR_CREATED.value)
        self.create_group_activity(group=self.group2, type=ActivityType.SEER_PR_CREATED.value)
        self._create_merged_pr_run(self.group1)

        assert self._matching_group_ids(["merged"]) == {self.group1.id}
        assert self._matching_group_ids(["review_pr"]) == {self.group2.id}

    def test_merged_scoped_to_latest_run(self) -> None:
        self.create_group_activity(group=self.group1, type=ActivityType.SEER_PR_CREATED.value)
        self._create_merged_pr_run(self.group1)
        run = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(run, source="autofix", project=self.project, group=self.group1)
        repo = self.create_repo(self.project, name="getsentry/other")
        pr = self.create_pull_request(
            repository_id=repo.id, organization_id=self.organization.id, key="102"
        )
        self.create_seer_run_pull_request(run, pr)

        assert self._matching_group_ids(["merged"]) == set()
        assert self._matching_group_ids(["review_pr"]) == {self.group1.id}

    def test_merged_ignores_non_autofix_runs(self) -> None:
        self.create_group_activity(group=self.group1, type=ActivityType.SEER_PR_CREATED.value)
        self._create_merged_pr_run(self.group1)
        chat_run = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(chat_run, source="chat", project=self.project, group=self.group1)

        assert self._matching_group_ids(["merged"]) == {self.group1.id}
        assert self._matching_group_ids(["review_pr"]) == set()

    def test_needs_investigation_recency(self) -> None:
        self.group1.update(seer_explorer_autofix_last_triggered=timezone.now() - timedelta(days=1))
        self.group2.update(seer_explorer_autofix_last_triggered=timezone.now() - timedelta(days=45))

        assert self._matching_group_ids(["needs_investigation"]) == {self.group1.id}

    def test_needs_investigation_excludes_milestones(self) -> None:
        self.group1.update(seer_explorer_autofix_last_triggered=timezone.now() - timedelta(days=1))
        self.create_group_activity(
            group=self.group1, type=ActivityType.SEER_SOLUTION_COMPLETED.value
        )

        assert self._matching_group_ids(["needs_investigation"]) == set()

    def test_null_group_activity_does_not_break_negation(self) -> None:
        Activity.objects.create(
            project=self.project, group=None, type=ActivityType.SEER_PR_CREATED.value
        )
        self.create_group_activity(group=self.group1, type=ActivityType.SEER_CODING_COMPLETED.value)

        assert self._matching_group_ids(["code_changes_ready"]) == {self.group1.id}

    def test_empty_values_matches_nothing(self) -> None:
        self.create_group_activity(group=self.group1, type=ActivityType.SEER_PR_CREATED.value)

        assert self._matching_group_ids([]) == set()

    def test_multiple_values_union(self) -> None:
        self.create_group_activity(group=self.group1, type=ActivityType.SEER_PR_CREATED.value)
        self.create_group_activity(
            group=self.group2, type=ActivityType.SEER_SOLUTION_COMPLETED.value
        )

        assert self._matching_group_ids(["review_pr", "solution_ready"]) == {
            self.group1.id,
            self.group2.id,
        }
