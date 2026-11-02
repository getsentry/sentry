from __future__ import annotations

from collections.abc import Collection, Iterable, Mapping, Sequence

from sentry.digests.notifications import (
    Digest,
    DigestInfo,
    build_digest,
    event_to_record,
    get_rules_from_workflows,
)
from sentry.digests.types import Record
from sentry.digests.utils import (
    get_event_from_groups_in_digest,
    get_participants_by_event,
    get_personalized_digests,
    sort_records,
)
from sentry.issues.ownership.grammar import Matcher, Owner, Rule, dump_schema
from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType, NotificationOrigin
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.notifications import create_workflow_notification_origin_for_rule
from sentry.types.actor import ActorType
from sentry.workflow_engine.models import Workflow


def as_group_event(event: Event | GroupEvent) -> GroupEvent:
    if isinstance(event, GroupEvent):
        return event
    return event.for_group(event.groups[0])


def _get_records(
    _project: Project, origins: Collection[NotificationOrigin], event: Event | GroupEvent
) -> list[Record]:
    return [event_to_record(as_group_event(event), tuple(origins))] if origins else []


class UtilitiesHelpersTestCase(TestCase, SnubaTestCase):
    def test_get_event_from_groups_in_digest(self) -> None:
        project = self.create_project(fire_project_created=True)
        workflow = self.create_workflow(organization=project.organization)
        origin = NotificationOrigin(
            label=workflow.name,
            environment_id=workflow.environment_id,
            workflow_id=workflow.id,
            legacy_rule_id=None,
        )

        events = [
            self.store_event(
                data={"fingerprint": ["group1"], "timestamp": before_now(minutes=2).isoformat()},
                project_id=project.id,
            ),
            self.store_event(
                data={"fingerprint": ["group1"], "timestamp": before_now(minutes=1).isoformat()},
                project_id=project.id,
            ),
            self.store_event(
                data={"fingerprint": ["group2"], "timestamp": before_now(minutes=1).isoformat()},
                project_id=project.id,
            ),
            self.store_event(
                data={"fingerprint": ["group3"], "timestamp": before_now(minutes=1).isoformat()},
                project_id=project.id,
            ),
            self.store_event(
                data={"fingerprint": ["group4"], "timestamp": before_now(minutes=1).isoformat()},
                project_id=project.id,
            ),
            self.store_event(
                data={"fingerprint": ["group5"], "timestamp": before_now(minutes=1).isoformat()},
                project_id=project.id,
            ),
        ]

        records = [event_to_record(as_group_event(event), (origin,)) for event in events]

        digest = build_digest(project, sort_records(records))[0]

        events.pop(0)  # remove event with same group
        assert {e.event_id for e in get_event_from_groups_in_digest(digest)} == {
            e.event_id for e in events
        }

    def test_event_to_record_with_workflow_id(self) -> None:
        project = self.create_project(fire_project_created=True)
        workflow = self.create_workflow(organization=project.organization)
        origin = NotificationOrigin(
            label=workflow.name,
            environment_id=workflow.environment_id,
            workflow_id=workflow.id,
            legacy_rule_id=None,
        )
        workflow_id = origin.workflow_id
        assert workflow_id is not None

        event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": before_now(minutes=2).isoformat()},
            project_id=project.id,
        )

        records = _get_records(project, (origin,), event)
        assert len(records) == 1
        record = records[0]
        assert record.value.rules == [workflow_id]

    def test_get_rules_from_workflows_uses_workflow_environment_for_linked_rule(self) -> None:
        project = self.create_project(fire_project_created=True)
        development = self.create_environment(project=project, name="development")
        production = self.create_environment(project=project, name="production")
        rule = self.create_project_rule(project=project, environment_id=development.id)
        workflow_id = create_workflow_notification_origin_for_rule(rule).workflow_id
        assert workflow_id is not None
        workflow = Workflow.objects.get(id=workflow_id)
        workflow.update(name="Renamed workflow", environment_id=production.id)

        rendered_rule = get_rules_from_workflows(project, {workflow_id})[workflow_id]

        assert rendered_rule.legacy_rule_id == rule.id
        assert rendered_rule.workflow_id == workflow_id
        assert rendered_rule.label == "Renamed workflow"
        assert rendered_rule.environment_id == production.id

    def test_get_rules_from_workflows_uses_unset_workflow_environment(self) -> None:
        project = self.create_project(fire_project_created=True)
        environment = self.create_environment(project=project)
        rule = self.create_project_rule(project=project, environment_id=environment.id)
        workflow_id = create_workflow_notification_origin_for_rule(rule).workflow_id
        assert workflow_id is not None
        Workflow.objects.filter(id=workflow_id).update(environment_id=None)

        rendered_rule = get_rules_from_workflows(project, {workflow_id})[workflow_id]

        assert rendered_rule.legacy_rule_id == rule.id
        assert rendered_rule.workflow_id == workflow_id
        assert rendered_rule.environment_id is None

    def test_get_rules_from_workflows_uses_workflow_environment_for_synthetic_rule(self) -> None:
        project = self.create_project(fire_project_created=True)
        environment = self.create_environment(project=project)
        workflow = self.create_workflow(
            organization=project.organization, environment_id=environment.id
        )

        rendered_rule = get_rules_from_workflows(project, {workflow.id})[workflow.id]

        assert rendered_rule.legacy_rule_id is None
        assert rendered_rule.workflow_id == workflow.id
        assert rendered_rule.environment_id == environment.id


def assert_rule_ids(digest: Digest, expected_rule_ids: list[int]) -> None:
    for rule, groups in digest.items():
        assert rule.legacy_rule_id in expected_rule_ids


def assert_get_personalized_digests(
    project: Project,
    digest: Digest,
    expected_result: Mapping[int, Iterable[Event]],
    target_type: ActionTargetType = ActionTargetType.ISSUE_OWNERS,
    target_identifier: int | None = None,
) -> None:
    result_user_ids = []
    participants_by_provider_by_event = get_participants_by_event(
        digest,
        project,
        target_type,
        target_identifier,
        fallthrough_choice=FallthroughChoiceType.ACTIVE_MEMBERS,
    )
    personalized_digests = get_personalized_digests(digest, participants_by_provider_by_event)
    for actor, user_digest in personalized_digests.items():
        assert actor.actor_type == ActorType.USER and actor.id in expected_result
        assert {e.event_id for e in get_event_from_groups_in_digest(user_digest)} == {
            e.event_id for e in expected_result[actor.id]
        }
        result_user_ids.append(actor.id)

    assert sorted(expected_result.keys()) == sorted(result_user_ids)


class GetPersonalizedDigestsTestCase(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user1 = self.create_user()
        self.user2 = self.create_user()
        self.user3 = self.create_user()
        self.user4 = self.create_user()
        self.user5 = self.create_user()  # this user has no events

        self.team1 = self.create_team()
        self.team2 = self.create_team()
        self.team3 = self.create_team()

        self.project = self.create_project(
            teams=[self.team1, self.team2, self.team3], fire_project_created=True
        )

        self.create_member(user=self.user1, organization=self.organization, teams=[self.team1])
        self.create_member(user=self.user2, organization=self.organization, teams=[self.team2])
        self.create_member(
            user=self.user3, organization=self.organization, teams=[self.team1, self.team2]
        )
        self.create_member(user=self.user4, organization=self.organization, teams=[self.team3])
        self.create_member(user=self.user5, organization=self.organization, teams=[self.team3])

        self.team1_events = self.create_events_from_filenames(
            self.project, ["hello.py", "goodbye.py", "hola.py", "adios.py"]
        )
        self.team2_events = self.create_events_from_filenames(
            self.project, ["old.cbl", "retro.cbl", "cool.cbl", "gem.cbl"]
        )

        self.user4_events = [
            self.store_event(
                data={
                    "stacktrace": {"frames": [{"lineno": 1, "filename": "foo.bar"}]},
                    "request": {"url": "helloworld.org"},
                    "timestamp": before_now(minutes=1).isoformat(),
                    "fingerprint": ["user4group1"],
                },
                project_id=self.project.id,
            ),
            self.store_event(
                data={
                    "stacktrace": {"frames": [{"lineno": 1, "filename": "bar.foo"}]},
                    "request": {"url": "helloworld.org"},
                    "timestamp": before_now(minutes=1).isoformat(),
                    "fingerprint": ["user4group2"],
                },
                project_id=self.project.id,
            ),
        ]
        self.team1_matcher = Matcher("path", "*.py")
        self.team2_matcher = Matcher("path", "*.cbl")
        self.user4_matcher = Matcher("url", "*.org")

        self.project_ownership = ProjectOwnership.objects.create(
            project_id=self.project.id,
            schema=dump_schema(
                [
                    Rule(
                        self.team1_matcher,
                        [Owner("team", self.team1.slug), Owner("user", self.user3.email)],
                    ),
                    Rule(self.team2_matcher, [Owner("team", self.team2.slug)]),
                    Rule(self.user4_matcher, [Owner("user", self.user4.email)]),
                ]
            ),
            fallthrough=True,
        )

        workflow = self.create_workflow(organization=self.organization, name="Test Alert")
        self.workflow_origin = NotificationOrigin(
            label=workflow.name,
            environment_id=workflow.environment_id,
            workflow_id=workflow.id,
            legacy_rule_id=None,
        )

    def create_events_from_filenames(
        self, project: Project, filenames: Sequence[str] | None = None
    ) -> list[Event]:
        return [
            self.store_event(
                data={
                    "stacktrace": {"frames": [{"filename": label}]},
                    "fingerprint": [label],
                    "timestamp": before_now(minutes=1).isoformat(),
                },
                project_id=project.id,
                assert_no_errors=False,
            )
            for index, label in enumerate(filenames or [])
        ]

    def test_simple(self) -> None:
        records = [
            event_to_record(as_group_event(event), (self.workflow_origin,))
            for event in self.team1_events + self.team2_events + self.user4_events
        ]
        digest = build_digest(self.project, sort_records(records))[0]

        expected_result = {
            self.user2.id: set(self.team2_events),
            self.user3.id: set(self.team1_events + self.team2_events),
            self.user4.id: set(self.user4_events),
        }

        assert_get_personalized_digests(self.project, digest, expected_result)

    def test_simple_with_workflow_id(self) -> None:
        records = []
        for event in self.team1_events + self.team2_events + self.user4_events:
            records.extend(_get_records(self.project, (self.workflow_origin,), event))

        digest = build_digest(self.project, sort_records(records))[0]

        expected_result = {
            self.user2.id: set(self.team2_events),
            self.user3.id: set(self.team1_events + self.team2_events),
            self.user4.id: set(self.user4_events),
        }

        assert_get_personalized_digests(self.project, digest, expected_result)

    def test_direct_email(self) -> None:
        """When the action type is not Issue Owners, then the target actor gets a digest."""
        self.project_ownership.update(fallthrough=False)
        records = [
            event_to_record(as_group_event(event), (self.workflow_origin,))
            for event in self.team1_events
        ]
        digest = build_digest(self.project, sort_records(records))[0]

        expected_result = {self.user1.id: set(self.team1_events)}
        assert_get_personalized_digests(
            self.project, digest, expected_result, ActionTargetType.MEMBER, self.user1.id
        )

    def test_direct_email_with_workflow_id(self) -> None:
        """When the action type is not Issue Owners, then the target actor gets a digest. - Workflow ID"""
        self.project_ownership.update(fallthrough=False)
        records = []
        for event in self.team1_events:
            records.extend(_get_records(self.project, (self.workflow_origin,), event))
        digest = build_digest(self.project, sort_records(records))[0]

        expected_result = {self.user1.id: set(self.team1_events)}
        assert_get_personalized_digests(
            self.project, digest, expected_result, ActionTargetType.MEMBER, self.user1.id
        )

    def test_team_without_members(self) -> None:
        team = self.create_team()
        project = self.create_project(teams=[team], fire_project_created=True)
        workflow = self.create_workflow(organization=project.organization)
        origin = NotificationOrigin(
            label=workflow.name,
            environment_id=workflow.environment_id,
            workflow_id=workflow.id,
            legacy_rule_id=None,
        )
        ProjectOwnership.objects.create(
            project_id=project.id,
            schema=dump_schema([Rule(Matcher("path", "*.cpp"), [Owner("team", team.slug)])]),
            fallthrough=True,
        )
        records = []
        for event in self.create_events_from_filenames(
            project, ["hello.py", "goodbye.py", "hola.py", "adios.py"]
        ):
            records.extend(_get_records(project, (origin,), event))
        digest = build_digest(project, sort_records(records))[0]
        user_ids = [member.user_id for member in team.member_set]
        assert not user_ids
        participants_by_provider_by_event = get_participants_by_event(digest, project)
        assert not {
            actor for actors in participants_by_provider_by_event.values() for actor in actors
        }  # no users in this team no digests should be processed

    def test_team_without_members_with_workflow_id(self) -> None:
        team = self.create_team()
        project = self.create_project(teams=[team], fire_project_created=True)
        ProjectOwnership.objects.create(
            project_id=project.id,
            schema=dump_schema([Rule(Matcher("path", "*.cpp"), [Owner("team", team.slug)])]),
            fallthrough=True,
        )
        records = []
        for event in self.create_events_from_filenames(
            project, ["hello.py", "goodbye.py", "hola.py", "adios.py"]
        ):
            records.extend(_get_records(project, (self.workflow_origin,), event))
        digest = build_digest(project, sort_records(records))[0]
        user_ids = [member.user_id for member in team.member_set]
        assert not user_ids
        participants_by_provider_by_event = get_participants_by_event(digest, project)
        assert not {
            actor for actors in participants_by_provider_by_event.values() for actor in actors
        }  # no users in this team no digests should be processed

    def test_only_everyone(self) -> None:
        events = self.create_events_from_filenames(
            self.project, ["hello.moz", "goodbye.moz", "hola.moz", "adios.moz"]
        )
        records = []
        for event in events:
            records.extend(_get_records(self.project, (self.workflow_origin,), event))
        digest = build_digest(self.project, sort_records(records))[0]
        expected_result = {
            self.user1.id: set(events),
            self.user2.id: set(events),
            self.user3.id: set(events),
            self.user4.id: set(events),
            self.user5.id: set(events),
        }
        assert_get_personalized_digests(self.project, digest, expected_result)

    def test_everyone_with_owners(self) -> None:
        events = self.create_events_from_filenames(
            self.project, ["hello.moz", "goodbye.moz", "hola.moz", "adios.moz"]
        )
        records = [
            event_to_record(as_group_event(event), (self.workflow_origin,))
            for event in events + self.team1_events
        ]
        digest = build_digest(self.project, sort_records(records))[0]
        expected_result = {
            self.user1.id: set(events),
            self.user2.id: set(events),
            self.user3.id: set(events + self.team1_events),
            self.user4.id: set(events),
            self.user5.id: set(events),
        }
        assert_get_personalized_digests(self.project, digest, expected_result)

    def test_everyone_with_owners_with_workflow_id(self) -> None:
        events = self.create_events_from_filenames(
            self.project, ["hello.moz", "goodbye.moz", "hola.moz", "adios.moz"]
        )
        records = []
        for event in events + self.team1_events:
            records.extend(_get_records(self.project, (self.workflow_origin,), event))
        digest = build_digest(self.project, sort_records(records))[0]
        expected_result = {
            self.user1.id: set(events),
            self.user2.id: set(events),
            self.user3.id: set(events + self.team1_events),
            self.user4.id: set(events),
            self.user5.id: set(events),
        }
        assert_get_personalized_digests(self.project, digest, expected_result)

    def test_empty_records(self) -> None:
        assert build_digest(self.project, []) == DigestInfo({}, {}, {})
