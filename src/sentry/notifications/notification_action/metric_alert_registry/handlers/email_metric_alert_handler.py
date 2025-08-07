import logging

from sentry.incidents.action_handlers import email_users
from sentry.incidents.models.incident import TriggerStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.integrations.types import ExternalProviders
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.metric_alert_registry.handlers.utils import (
    get_alert_rule_serializer,
    get_detailed_incident_serializer,
)
from sentry.notifications.notification_action.registry import metric_alert_handler_registry
from sentry.notifications.notification_action.types import BaseMetricAlertHandler
from sentry.notifications.types import NotificationSettingEnum
from sentry.notifications.utils.participants import get_notification_recipients
from sentry.types.actor import Actor, ActorType
from sentry.utils.email import get_email_addresses
from sentry.workflow_engine.models import Action, Detector

logger = logging.getLogger(__name__)


@metric_alert_handler_registry.register(Action.Type.EMAIL)
class EmailMetricAlertHandler(BaseMetricAlertHandler):
    @classmethod
    def send_alert(
        cls,
        notification_context: NotificationContext,
        alert_context: AlertContext,
        metric_issue_context: MetricIssueContext,
        open_period_context: OpenPeriodContext,
        trigger_status: TriggerStatus,
        notification_uuid: str,
        organization: Organization,
        project: Project,
    ) -> None:

        detector = Detector.objects.get(id=alert_context.action_identifier_id)
        if not detector:
            raise ValueError("Detector not found")

        open_period = GroupOpenPeriod.objects.get(id=open_period_context.id)
        if not open_period:
            raise ValueError("Open period not found")

        alert_rule_serialized_response = get_alert_rule_serializer(detector)
        incident_serialized_response = get_detailed_incident_serializer(open_period)

        recipients = list(
            get_email_addresses(
                get_targets(organization, project, notification_context), project=project
            ).items()
        )

        targets = [(user_id, email) for user_id, email in recipients]

        logger.info(
            "notification_action.execute_via_metric_alert_handler.email",
            extra={
                "action_id": alert_context.action_identifier_id,
            },
        )
        # TODO(iamrajjoshi): Add analytics
        email_users(
            metric_issue_context=metric_issue_context,
            open_period_context=open_period_context,
            alert_context=alert_context,
            alert_rule_serialized_response=alert_rule_serialized_response,
            incident_serialized_response=incident_serialized_response,
            trigger_status=trigger_status,
            targets=targets,
            project=project,
            notification_uuid=notification_uuid,
        )


def get_targets(
    organization: Organization,
    project: Project,
    notification_context: NotificationContext,
) -> set[int]:
    target = get_target(organization, notification_context)
    if not target:
        return set()

    if notification_context.target_type == ActionTarget.USER:
        assert isinstance(target, OrganizationMember)

        if target.user_id:
            return {target.user_id}
        return set()

    elif notification_context.target_type == ActionTarget.TEAM:
        assert isinstance(target, Team)
        out = get_notification_recipients(
            recipients=list(
                Actor(id=member.user_id, actor_type=ActorType.USER) for member in target.member_set
            ),
            type=NotificationSettingEnum.ISSUE_ALERTS,
            organization_id=organization.id,
            project_ids=[project.id],
            actor_type=ActorType.USER,
        )
        users = out[ExternalProviders.EMAIL]

        return {user.id for user in users}

    return set()


def get_target(
    organization: Organization, notification_context: NotificationContext
) -> OrganizationMember | Team | str | None:
    if notification_context.target_identifier is None:
        return None

    if notification_context.target_type == ActionTarget.USER:
        try:
            return OrganizationMember.objects.get(
                user_id=int(notification_context.target_identifier),
                organization=organization,
            )
        except OrganizationMember.DoesNotExist:
            pass

    elif notification_context.target_type == ActionTarget.TEAM:
        try:
            return Team.objects.get(id=int(notification_context.target_identifier))
        except Team.DoesNotExist:
            pass

    return None
