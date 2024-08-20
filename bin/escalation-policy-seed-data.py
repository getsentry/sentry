#!/usr/bin/env python
import dataclasses
import datetime
import random
from functools import cached_property
from typing import Protocol

from sentry.runner import configure

configure()

import click


@click.command()
def seed_policy_data():
    from sentry.escalation_policies.models.escalation_policy import (
        EscalationPolicy,
        EscalationPolicyStep,
        EscalationPolicyStepRecipient,
    )
    from sentry.escalation_policies.models.rotation_schedule import (
        RotationSchedule,
        RotationScheduleLayer,
        RotationScheduleLayerRotationType,
        RotationScheduleOverride,
        RotationScheduleUserOrder,
        ScheduleLayerRestriction,
    )
    from sentry.models.organization import Organization
    from sentry.models.team import Team, TeamStatus
    from sentry.testutils.factories import Factories  # noqa: S007

    class TeamAndUserId(Protocol):
        team: Team
        user_id: int

    @dataclasses.dataclass
    class OrgContext:
        org_id: int = 1
        team_count: int = 5
        user_count: int = 5
        schedule_count: int = 5

        def ensure_team_and_user_pool(self):
            for i in range(self.team_count - len(self.teams)):
                self.teams.append(
                    Factories.create_team(
                        organization=self.organization,
                        name=f"Demo Team {i}",
                    )
                )
            for i in range(self.user_count - len(self.user_ids)):
                u = Factories.create_user()
                Factories.create_member(teams=self.teams, user=u, organization=self.organization)
                self.user_ids.append(u.id)
            for i in range(self.schedule_count - len(self.schedules)):
                self.schedules.append(RotationScheduleFactory(org_context=self).build())

        def contextualize_slug_or_user_id(
            self, model: TeamAndUserId, slug_or_user_id: str | int | None
        ):
            if isinstance(slug_or_user_id, str):
                model.team = next(t for t in self.teams if t.slug == slug_or_user_id)
            elif isinstance(slug_or_user_id, int):
                model.user_id = slug_or_user_id
            else:
                if random.random() < 0.5:
                    slug_or_user_id = random.choice(self.teams).slug
                else:
                    slug_or_user_id = random.choice(self.user_ids)
                self.contextualize_slug_or_user_id(model, slug_or_user_id)

        @cached_property
        def organization(self) -> Organization:
            return Organization.objects.get(pk=self.org_id)

        @cached_property
        def user_ids(self) -> list[int]:
            return list(self.organization.member_set.values_list("user_id", flat=True))

        @cached_property
        def schedules(self) -> list[RotationSchedule]:
            return list(RotationSchedule.objects.filter(organization=self.organization))

        @cached_property
        def teams(self) -> list[Team]:
            return list(
                Team.objects.filter(
                    status=TeamStatus.ACTIVE,
                    organization=self.organization,
                )
            )

    @dataclasses.dataclass
    class RotationScheduleFactory:
        org_context: OrgContext
        name: str = ""
        owner_user_id_or_team_slug: str | int | None = None

        @cached_property
        def organization(self) -> Organization:
            return self.org_context.organization

        @cached_property
        def rotation_schedule(self) -> RotationSchedule:
            schedule = RotationSchedule(
                organization=self.organization,
                name=self.final_name,
            )

            self.org_context.contextualize_slug_or_user_id(
                schedule, self.owner_user_id_or_team_slug
            )

            schedule.save()
            return schedule

        @cached_property
        def final_name(self) -> str:
            c = 1
            name = self.name or "Rotation Schedule"
            while True:
                if not RotationSchedule.objects.filter(
                    organization=self.organization, name=name
                ).exists():
                    break
                name = name.removesuffix(" " + str(c))
                c += 1
                name += " " + str(c)
            return name

        @cached_property
        def overrides(self) -> list[RotationScheduleOverride]:
            start = datetime.datetime.utcnow() - datetime.timedelta(hours=12)
            results = []
            for i in range(random.randint(0, 6)):
                end = start + datetime.timedelta(hours=random.randint(3, 9))
                user_id = random.choice(self.org_context.user_ids)
                override = RotationScheduleOverride(
                    rotation_schedule=self.rotation_schedule,
                    user_id=user_id,
                    start_time=start,
                    end_time=end,
                )
                override.save()
                start = end + datetime.timedelta(hours=random.randint(3, 9))
                results.append(override)
            return results

        def make_restrictions(self) -> list[tuple[str, str]]:
            start = 0
            result = []
            for i in range(random.randint(0, 4)):
                start += random.randint(1, 60 * 60 * 5)
                end = start + random.randint(1, 60 * 60 * 5)
                if end >= 60 * 60 * 24:
                    break
                result.append(
                    (f"{int(start/60):02d}:{start%60:02d}", f"{int(end/60):02d}:{end%60:02d}")
                )
            return result

        @cached_property
        def schedule_layers(self) -> list[RotationScheduleLayer]:
            results = []
            for i in range(random.randint(1, 5)):
                layer = RotationScheduleLayer(
                    schedule=self.rotation_schedule,
                    precedence=i,
                    rotation_type=random.choice(list(RotationScheduleLayerRotationType)),
                    handoff_time=f"{random.randint(0, 23):02d}:{random.randint(0, 59):02d}",
                    start_date=(
                        datetime.datetime.utcnow() - datetime.timedelta(days=random.randint(1, 30))
                    ).date(),
                )

                restriction: ScheduleLayerRestriction = {
                    "Sun": self.make_restrictions(),
                    "Mon": self.make_restrictions(),
                    "Tue": self.make_restrictions(),
                    "Wed": self.make_restrictions(),
                    "Thu": self.make_restrictions(),
                    "Fri": self.make_restrictions(),
                    "Sat": self.make_restrictions(),
                }

                layer.schedule_layer_restrictions = restriction
                layer.save()
                results.append(layer)
            return results

        @cached_property
        def user_orders(self) -> list[RotationScheduleUserOrder]:
            result = []
            for layer in self.schedule_layers:
                user_ids = random.sample(self.org_context.user_ids, random.randint(1, 5))
                for i, user_id in enumerate(user_ids):
                    uo = RotationScheduleUserOrder(
                        schedule_layer=layer,
                        user_id=user_id,
                        order=i,
                    )
                    uo.save()
                    result.append(uo)
            return result

        def build(self):
            return (
                self.rotation_schedule,
                self.schedule_layers,
                self.user_orders,
            )[0]

    @dataclasses.dataclass
    class PolicyFactory:
        org_context: OrgContext
        owner_user_id_or_team_slug: str | int | None = None
        name: str = ""
        repeat_n_times: int = dataclasses.field(default_factory=lambda: random.randint(1, 5))

        @cached_property
        def organization(self) -> Organization:
            return self.org_context.organization

        @cached_property
        def final_name(self) -> str:
            c = 1
            name = self.name or "Escalation Policy"
            while True:
                if not EscalationPolicy.objects.filter(
                    organization=self.organization, name=name
                ).exists():
                    break
                name = name.removesuffix(" " + str(c))
                c += 1
                name += " " + str(c)
            return name

        @cached_property
        def policy(self) -> EscalationPolicy:
            policy = EscalationPolicy(
                organization=self.organization,
                name=self.final_name,
                description="",
                repeat_n_times=self.repeat_n_times,
            )

            self.org_context.contextualize_slug_or_user_id(policy, self.owner_user_id_or_team_slug)

            policy.save()
            return policy

        @cached_property
        def steps(self):
            result = []
            for i in range(5):
                step = EscalationPolicyStep(
                    policy=self.policy,
                    step_number=i + 1,
                    escalate_after_sec=random.randint(1, 5) * 15,
                )
                step.save()
                result.append(step)
            return result

        @cached_property
        def recipients(self):
            result = []
            for step in self.steps:
                result.append(
                    EscalationPolicyStepRecipient(
                        escalation_policy_step=step,
                        schedule=random.choice(self.org_context.schedules),
                    )
                )
                result.append(
                    EscalationPolicyStepRecipient(
                        escalation_policy_step=step,
                        team=random.choice(self.org_context.teams),
                    )
                )
                result.append(
                    EscalationPolicyStepRecipient(
                        escalation_policy_step=step,
                        user_id=random.choice(self.org_context.user_ids),
                    )
                )

            for recipient in result:
                recipient.save()

            return result

        def build(self):
            return (
                self.policy,
                self.steps,
                self.recipients,
            )[0]

    context = OrgContext()
    context.ensure_team_and_user_pool()

    for i in range(5):
        PolicyFactory(org_context=context).build()


if __name__ == "__main__":
    seed_policy_data()
