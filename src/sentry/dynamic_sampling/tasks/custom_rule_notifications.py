"""
Task for sending notifications when custom rules have gathered enough samples.
"""

from __future__ import annotations

from datetime import datetime, timezone

import sentry_sdk
from django.http import QueryDict

from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.models.dynamicsampling import CustomDynamicSamplingRule
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.templates.custom_rule import CustomRuleSamplesFulfilled
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.search.events.types import SnubaParams
from sentry.silo.base import SiloMode
from sentry.snuba import discover
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import telemetry_experience_tasks
from sentry.taskworker.retry import Retry
from sentry.users.services.user.service import user_service
from sentry.utils.email import MessageBuilder
from sentry.utils.json import JSONDecodeError

MIN_SAMPLES_FOR_NOTIFICATION = 10


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.custom_rule_notifications",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=1 * 60 + 5,
    retry=Retry(times=5, delay=5),
    silo_mode=SiloMode.REGION,
)
@dynamic_sampling_task
def custom_rule_notifications() -> None:
    """
    Iterates through all active CustomRules and sends a notification to the rule creator
    whenever enough samples have been collected.
    """
    now = datetime.now(tz=timezone.utc)
    # just for protection filter out rules that are outside the time range (in case the
    # task that deactivates rules is not working)
    custom_active_rules = (
        CustomDynamicSamplingRule.objects.filter(
            is_active=True,
            notification_sent=False,
            start_date__lte=now,
            end_date__gte=now,
        )
        .order_by("organization_id")
        .iterator()
    )

    for rule in custom_active_rules:
        num_samples = get_num_samples(rule)

        if num_samples >= MIN_SAMPLES_FOR_NOTIFICATION:
            send_notification(rule, num_samples)
            rule.notification_sent = True
            rule.save()


def get_num_samples(rule: CustomDynamicSamplingRule) -> int:
    """
    Returns the number of samples accumulated for the given rule.
    """
    projects = rule.projects.all()

    if not projects:
        # org rule get all projects for org
        projects = rule.organization.project_set.filter(status=ObjectStatus.ACTIVE)

    project_id = []
    project_objects = []
    for project in projects:
        project_id.append(project.id)
        project_objects.append(project)

    params = SnubaParams(
        start=rule.start_date,
        end=rule.end_date,
        projects=project_objects,
        organization=rule.organization,
    )

    try:
        result = discover.query(
            selected_columns=["count()"],
            snuba_params=params,
            query=rule.query if rule.query is not None else "",
            referrer="dynamic_sampling.tasks.custom_rule_notifications",
        )
        return result["data"][0]["count"]
    except JSONDecodeError:
        with sentry_sdk.new_scope() as scope:
            scope.set_tag("rule_id", rule.id)
            sentry_sdk.capture_exception()
        return 0


def send_notification(rule: CustomDynamicSamplingRule, num_samples: int) -> None:
    """
    Notifies the rule creator that samples have been gathered.
    """
    user_id = rule.created_by_id
    if not user_id:
        return

    creator = user_service.get_user(user_id=user_id)
    if not creator or not creator.email:
        return

    projects = rule.projects.all()
    project_ids = [p.id for p in projects]

    data = CustomRuleSamplesFulfilled(
        query=rule.query,
        num_samples=num_samples,
        start_date=rule.start_date,
        end_date=rule.end_date,
        discover_link=create_discover_link(rule, project_ids),
    )

    if NotificationService.has_access(rule.organization, data.source):
        NotificationService(data=data).notify_async(
            targets=[
                GenericNotificationTarget(
                    provider_key=NotificationProviderKey.EMAIL,
                    resource_type=NotificationTargetResourceType.EMAIL,
                    resource_id=creator.email,
                )
            ]
        )
    else:
        # Fallback to old email system
        subject_template = "We've collected {num_samples} samples for the query: {query} you made"
        params = {
            "query": rule.query,
            "num_samples": num_samples,
            "start_date": rule.start_date.strftime("%Y-%m-%d %H:%M:%S"),
            "end_date": rule.end_date.strftime("%Y-%m-%d %H:%M:%S"),
            "name": creator.name,
            "email": creator.email,
            "user_name": creator.username,
            "display_name": creator.get_display_name(),
            "discover_link": create_discover_link(rule, project_ids),
        }
        subject = subject_template.format(**params)

        msg = MessageBuilder(
            subject=subject,
            template="sentry/emails/dyn-sampling-custom-rule-fulfilled.txt",
            html_template="sentry/emails/dyn-sampling-custom-rule-fulfilled.html",
            context=params,
        )
        msg.send_async([creator.email])


def create_discover_link(rule: CustomDynamicSamplingRule, projects: list[int]) -> str:
    """
    Creates a discover link for the given rule.
    It will point to a discover query using the same query as the rule
    and the same time range as the rule.
    """
    if len(projects) == 0:
        projects = [-1]

    project_ids = [str(p) for p in projects]

    q = QueryDict(mutable=True)
    q["start"] = rule.start_date.strftime("%Y-%m-%dT%H:%M:%S")
    q["end"] = rule.end_date.strftime("%Y-%m-%dT%H:%M:%S")
    q.setlist("field", ["title", "event.type", "project", "user.display", "timestamp"])
    q.setlist("project", project_ids)
    q["name"] = "All Events"
    q["query"] = rule.query if rule.query else ""
    q["utc"] = "true"
    q["yAxis"] = "count()"
    q["sort"] = "-timestamp"
    q["queryDataset"] = "transaction-like"
    q["dataset"] = "transactions"

    query_string = q.urlencode()
    discover_url = rule.organization.absolute_url(
        f"/organizations/{rule.organization.slug}/discover/results/", query=query_string
    )
    return discover_url


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.clean_custom_rule_notifications",
    namespace=telemetry_experience_tasks,
    processing_deadline_duration=3 * 60 + 5,
    retry=Retry(times=5, delay=5),
    silo_mode=SiloMode.REGION,
)
@dynamic_sampling_task
def clean_custom_rule_notifications() -> None:
    CustomDynamicSamplingRule.deactivate_old_rules()
