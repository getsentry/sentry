from collections.abc import Callable, Generator, Sequence

from django.db.models import Q

from sentry.escalation_policies import EscalationPolicy, trigger_escalation_policy
from sentry.eventstore.models import GroupEvent
from sentry.mail.actions import NotifyEmailTarget
from sentry.mail.forms.notify_email import NotifyEmailForm
from sentry.rules.actions.base import EventAction
from sentry.rules.base import CallbackFuture
from sentry.types.actor import ActorType
from sentry.types.rules import RuleFuture


class NotifyEscalationAction(EventAction):
    """Used for triggering a messages according to escalation policies."""

    id = "sentry.rules.actions.escalation.NotifyEscalationAction"
    label = "Send a notification according to the triage schedule"
    prompt = "Send a notification according to the triage schedule"

    form_cls = NotifyEmailForm

    @staticmethod
    def _create_trigger_escalation_callback(
        policy: EscalationPolicy,
    ) -> Callable[[GroupEvent, Sequence[RuleFuture]], None]:
        def callback(event: GroupEvent, futures: Sequence[RuleFuture]) -> None:
            trigger_escalation_policy(policy, event.group)

        return callback

    def after(
        self, event: GroupEvent, notification_uuid: str | None = None
    ) -> Generator[CallbackFuture]:
        user_ids: list[int] = []
        team_ids: list[int] = []
        target = NotifyEmailTarget.unpack(self)
        for recipient in target.get_eligible_recipients(event):
            if recipient.actor_type == ActorType.USER:
                user_ids.append(recipient.id)
            if recipient.actor_type == ActorType.TEAM:
                team_ids.append(recipient.id)

        query = EscalationPolicy.objects.filter(organization_id=event.group.organization.id)
        query = query.filter(Q(user_id__in=user_ids) | Q(team_id__in=team_ids))
        for policy in query:
            yield self.future(self._create_trigger_escalation_callback(policy))
