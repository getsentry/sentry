from datetime import timedelta

from django.utils import timezone

from sentry.models.group import Group
from sentry.models.rule import Rule
from sentry.tasks.base import instrumented_task

NEW_ISSUE_WEEKLY_THRESHOLD = 10


def calculate_threshold_met(project_id: int) -> bool:
    """
    Calculate whether the new issue threshold has been met. The threshold is met if:
    - There are 10 new issues per week for the last 3 weeks
    - There are 20 new issues per week for the last 2 weeks
    """

    one_week_ago = timezone.now() - timedelta(weeks=1)
    two_weeks_ago = timezone.now() - timedelta(weeks=2)
    three_weeks_ago = timezone.now() - timedelta(weeks=3)

    # Get the count of new issues per week for the past 3 weeks
    new_groups = Group.objects.filter(
        project_id=project_id,
        first_seen__gte=three_weeks_ago,
    )
    last_week_count = new_groups.filter(first_seen__gte=one_week_ago).count()
    two_weeks_ago_count = new_groups.filter(
        first_seen__gte=two_weeks_ago,
        first_seen__lt=one_week_ago,
    ).count()
    three_weeks_ago_count = new_groups.filter(
        first_seen__gte=three_weeks_ago,
        first_seen__lt=two_weeks_ago,
    ).count()

    # Case 1: 10 new issues per week for the last 3 weeks
    condition_1 = (
        last_week_count >= NEW_ISSUE_WEEKLY_THRESHOLD
        and two_weeks_ago_count >= NEW_ISSUE_WEEKLY_THRESHOLD
        and three_weeks_ago_count >= NEW_ISSUE_WEEKLY_THRESHOLD
    )

    # Case 2: 20 new issues per week for the last 2 weeks
    condition_2 = (
        last_week_count >= 2 * NEW_ISSUE_WEEKLY_THRESHOLD
        and two_weeks_ago_count >= 2 * NEW_ISSUE_WEEKLY_THRESHOLD
    )

    return condition_1 or condition_2


@instrumented_task(
    name="sentry.tasks.check_new_issue_threshold_met",
    queue="check_new_issue_threshold_met",
    default_retry_delay=60,
    max_retries=1,
)
def check_new_issue_threshold_met(project_id: int) -> None:
    """
    Check if the new issue threshold has been met for a project.
    Update the data for rules with HighPriorityIssueCondition if the threshold has been met.

    Rules with {new_issue_threshold_met: False} will default to using the FirstSeenEventCondition condition when applied.
    """
    rules_with_high_priority = Rule.objects.filter(
        project_id=project_id, data__contains="HighPriorityIssueCondition"
    )

    if not rules_with_high_priority.exists():
        return

    threshold_met = any(
        rule.data.get("new_issue_threshold_met") for rule in rules_with_high_priority
    )
    if not threshold_met:
        threshold_met = calculate_threshold_met(project_id)

    if not threshold_met:
        return

    for rule in rules_with_high_priority:
        if rule.data.get("new_issue_threshold_met"):
            continue

        rule.data["new_issue_threshold_met"] = True
        rule.save()
