from sentry import features
from sentry.models import Organization, Project, Team, User, UserOption
from sentry.tasks.base import instrumented_task
from sentry.tasks.reports.types import Skipped
from sentry.tasks.reports.utils.util import (
    _get_organization_queryset,
    _to_interval,
    has_valid_aggregates,
)
from sentry.utils.compat import filter, zip

DISABLED_ORGANIZATIONS_USER_OPTION_KEY = "reports:disabled-organizations"


def user_subscribed_to_organization_reports(user, organization):
    return organization.id not in (
        UserOption.objects.get_value(user, key=DISABLED_ORGANIZATIONS_USER_OPTION_KEY)
        or []  # A small number of users have incorrect data stored
    )


@instrumented_task(
    name="sentry.tasks.reports.deliver_organization_user_report",
    queue="reports.deliver",
    max_retries=5,
    acks_late=True,
)
def deliver_organization_user_report(
    timestamp,
    duration,
    organization_id: int,
    user_id: int,
    dry_run: bool = False,
) -> None:
    from sentry.tasks.reports import backend, logger

    try:
        organization = _get_organization_queryset().get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "reports.organization.missing",
            extra={
                "timestamp": timestamp,
                "duration": duration,
                "organization_id": organization_id,
            },
        )
        return

    user = User.objects.get(id=user_id)

    if features.has("organizations:weekly-report-debugging", organization):
        logger.info(
            "reports.deliver_organization_user_report.begin",
            extra={
                "user_id": user.id,
                "organization_id": organization.id,
            },
        )
    if not user_subscribed_to_organization_reports(user, organization):
        if features.has("organizations:weekly-report-debugging", organization):
            logger.info(
                "reports.user.unsubscribed",
                extra={
                    "user_id": user.id,
                    "organization_id": organization.id,
                },
            )
        logger.debug(
            f"Skipping report for {organization} to {user}, user is not subscribed to reports."
        )
        return Skipped.NotSubscribed

    projects = set()
    for team in Team.objects.get_for_user(organization, user):
        projects.update(Project.objects.get_for_user(team, user, _skip_team_check=True))

    if not projects:
        if features.has("organizations:weekly-report-debugging", organization):
            logger.info(
                "reports.user.no_projects",
                extra={
                    "user_id": user.id,
                    "organization_id": organization.id,
                },
            )
        logger.debug(
            f"Skipping report for {organization} to {user}, user is not associated with any projects."
        )
        return Skipped.NoProjects

    interval = _to_interval(timestamp, duration)
    projects = list(projects)

    inclusion_predicates = [
        lambda interval, project__report: project__report[1] is not None,
        has_valid_aggregates,
    ]

    reports = dict(
        filter(
            lambda item: all(predicate(interval, item) for predicate in inclusion_predicates),
            zip(projects, backend.fetch(timestamp, duration, organization, projects)),
        )
    )

    if not reports:
        if features.has("organizations:weekly-report-debugging", organization):
            logger.info(
                "reports.user.no_reports",
                extra={
                    "user_id": user.id,
                    "organization_id": organization.id,
                },
            )
        logger.debug(
            f"Skipping report for {organization} to {user}, no qualifying reports to deliver."
        )
        return Skipped.NoReports

    from sentry.tasks.reports.utils.notification import build_message

    message = build_message(timestamp, duration, organization, user, reports)

    if not dry_run:
        if features.has("organizations:weekly-report-debugging", organization):
            logger.info(
                "reports.deliver_organization_user_report.finish",
                extra={
                    "user_id": user.id,
                    "organization_id": organization.id,
                },
            )
        message.send()
