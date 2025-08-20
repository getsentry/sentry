import contextlib
import dataclasses
from collections.abc import Callable
from contextlib import ExitStack
from datetime import datetime, timedelta
from typing import Any
from unittest import mock

import pytest
from celery.app.task import Task

from sentry.escalation_policies.logic import trigger_escalation_policy
from sentry.escalation_policies.models.escalation_policy_state import (
    EscalationPolicyState,
    EscalationPolicyStateType,
)
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import freeze_time


@dataclasses.dataclass
class ApplySyncMock:
    queue: list[tuple[str, Callable[[bool], None]]] = dataclasses.field(default_factory=list)
    stack: ExitStack = dataclasses.field(default_factory=contextlib.ExitStack)

    def apply_async(
        self,
        task: Task,
        args: tuple[Any, ...] = (),
        kwargs: dict[str, Any] | None = None,
        countdown: float | None = None,
        **options: Any,
    ):
        when = datetime.utcnow() + timedelta(seconds=countdown or 0)

        def invocation(travel_future: bool):
            if travel_future:
                with freeze_time(when):
                    task(*args, **kwargs)
            else:
                task(*args, **kwargs)

        self.queue.append((task.name, invocation))

    def run_next(self, travel_future: bool):
        self.queue.pop(0)[1](travel_future)

    def run_all(self, task_name: str, travel_future: bool) -> int:
        count = 0
        while self.queue[0][0] == task_name:
            self.run_next(travel_future)
            count += 1
        return count

    def __enter__(self):
        self.stack = ExitStack()
        self.stack.__enter__()
        self.stack.enter_context(mock.patch.object(Task, "apply_async", self.apply_async))
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return self.stack.__exit__(exc_type, exc_val, exc_tb)


@pytest.mark.django_db(transaction=True, databases="__all__")
def test_escalation_to_completion(captured_sent_emails):
    org = Factories.create_organization()
    users = [Factories.create_user(), Factories.create_user()]
    teams = [
        Factories.create_team(organization=org, members=users),
        Factories.create_team(organization=org, members=users),
    ]
    schedule = Factories.create_rotation_schedule(organization=org, owner=users[0])
    Factories.create_rotation_schedule_layer(
        schedule=schedule, user_ids=[users[0].id, users[1].id], precedence=1
    )
    Factories.create_rotation_schedule_layer(
        schedule=schedule, user_ids=[users[0].id, users[1].id], precedence=2
    )

    policy = Factories.create_escalation_policy(
        organization=org,
        schedules=[schedule],
        teams=teams,
        users=users,
        name="Policy",
        user_id=Factories.create_user().id,
        repeat_n_times=3,
    )

    project = Factories.create_project(organization=org, teams=teams)
    group = Factories.create_group(project=project)

    with ApplySyncMock() as mock:
        assert not EscalationPolicyState.objects.filter(escalation_policy=policy).exists()
        state = trigger_escalation_policy(policy, group=group)
        assert EscalationPolicyState.objects.filter(escalation_policy=policy, group=group).exists()

        assert mock.queue[0][0] == "sentry.escalation_policies.tasks.escalation_check"
        mock.run_next(True)

        assert mock.queue[0][0] == "sentry.tasks.email.send_email"
        mock.run_next(False)
        assert "acknowledge" in captured_sent_emails[0].message().as_string()

        mock.run_all("sentry.tasks.email.send_email", False)

        assert mock.queue[0][0] == "sentry.escalation_policies.tasks.escalation_check"
        state.state = EscalationPolicyStateType.ACKNOWLEDGED
        state.save()

        mock.run_next(True)
        assert not mock.queue
