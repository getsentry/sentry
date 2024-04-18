from datetime import timedelta

from django.db.models import Count, F, Q
from django.utils import timezone

from sentry.models.group import Group
from sentry.models.project import Project
from sentry.tasks.base import instrumented_task

NEW_ISSUE_WEEKLY_THRESHOLD = 10
new_issue_threshold_key = (
    lambda project_id: f"issues.priority.calculate_new_issue_threshold:{project_id}"
)


def calculate_threshold_met(project_id: int) -> bool:
    """
    Calculate whether the new issue threshold has been met. The threshold is met if:
    - There are 10 new issues per week for the last 3 weeks
    - There are 20 new issues per week for the last 2 weeks
    """

    one_week_ago = timezone.now() - timedelta(weeks=1)
    two_weeks_ago = timezone.now() - timedelta(weeks=2)
    three_weeks_ago = timezone.now() - timedelta(weeks=3)

    counts = Group.objects.filter(
        project_id=project_id,
        first_seen__gte=three_weeks_ago,
    ).aggregate(
        last_week=Count("id", filter=Q(first_seen__gte=one_week_ago)),
        two_weeks_ago=Count(
            "id", filter=Q(first_seen__gte=two_weeks_ago, first_seen__lt=one_week_ago)
        ),
        three_weeks_ago=Count(
            "id", filter=Q(first_seen__gte=three_weeks_ago, first_seen__lt=two_weeks_ago)
        ),
    )

    # Case 1: The weekly threshold has been met for the last 3 weeks
    condition_1 = (
        counts["last_week"] >= NEW_ISSUE_WEEKLY_THRESHOLD
        and counts["two_weeks_ago"] >= NEW_ISSUE_WEEKLY_THRESHOLD
        and counts["three_weeks_ago"] >= NEW_ISSUE_WEEKLY_THRESHOLD
    )

    # Case 2: The weekly threshold has been doubled for the last 2 weeks
    condition_2 = (
        counts["last_week"] >= 2 * NEW_ISSUE_WEEKLY_THRESHOLD
        and counts["two_weeks_ago"] >= 2 * NEW_ISSUE_WEEKLY_THRESHOLD
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
    Check if the new issue threshold has been met for a project and sets the project flag accordingly.

    The calculation is done once per day and the result is cached for 24 hours.
    Rules with {new_issue_threshold_met: False} will default to using the FirstSeenEventCondition condition when applied.
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return

    if project.flags.has_high_priority_alerts:
        return

    threshold_met = calculate_threshold_met(project.id)
    if threshold_met:
        project.update(flags=F("flags").bitor(Project.flags.has_high_priority_alerts))
