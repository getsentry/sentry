from __future__ import annotations

from typing import Iterable, Mapping, Sequence

from sentry.digests import Digest
from sentry.digests.notifications import build_digest, event_to_record
from sentry.digests.utils import (
    get_event_from_groups_in_digest,
    get_participants_by_event,
    get_personalized_digests,
    sort_records,
)
from sentry.eventstore.models import Event
from sentry.models import Project, ProjectOwnership
from sentry.notifications.types import ActionTargetType
from sentry.ownership.grammar import Matcher, Owner, Rule, dump_schema
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class UtilitiesHelpersTestCase(TestCase, SnubaTestCase):
    def create_event(self, project_id):
        return (
            self.store_event(
                data={"timestamp": iso_format(before_now(minutes=1))}, project_id=project_id
            ),
        )

    def test_get_event_from_groups_in_digest(self):
        project = self.create_project(fire_project_created=True)
        rule = project.rule_set.all()[0]

        events = [
            self.store_event(
                data={"fingerprint": ["group1"], "timestamp": iso_format(before_now(minutes=2))},
                project_id=project.id,
            ),
            self.store_event(
                data={"fingerprint": ["group1"], "timestamp": iso_format(before_now(minutes=1))},
                project_id=project.id,
            ),
            self.store_event(
                data={"fingerprint": ["group2"], "timestamp": iso_format(before_now(minutes=1))},
                project_id=project.id,
            ),
            self.store_event(
                data={"fingerprint": ["group3"], "timestamp": iso_format(before_now(minutes=1))},
                project_id=project.id,
            ),
            self.store_event(
                data={"fingerprint": ["group4"], "timestamp": iso_format(before_now(minutes=1))},
                project_id=project.id,
            ),
            self.store_event(
                data={"fingerprint": ["group5"], "timestamp": iso_format(before_now(minutes=1))},
                project_id=project.id,
            ),
        ]

        digest = build_digest(
            project, sort_records([event_to_record(event, (rule,)) for event in events])
        )[0]

        events.pop(0)  # remove event with same group
        assert {e.event_id for e in get_event_from_groups_in_digest(digest)} == {
            e.event_id for e in events
        }


def assert_get_personalized_digests(
    project: Project,
    digest: Digest,
    expected_result: Mapping[int, Iterable[Event]],
    target_type: ActionTargetType = ActionTargetType.ISSUE_OWNERS,
    target_identifier: int | None = None,
):
    result_user_ids = []
    participants_by_provider_by_event = get_participants_by_event(
        digest, project, target_type, target_identifier
    )
    personalized_digests = get_personalized_digests(digest, participants_by_provider_by_event)
    for actor_id, user_digest in personalized_digests.items():
        assert actor_id in expected_result
        assert {e.event_id for e in get_event_from_groups_in_digest(user_digest)} == {
            e.event_id for e in expected_result[actor_id]
        }
        result_user_ids.append(actor_id)

    assert sorted(expected_result.keys()) == sorted(result_user_ids)


class GetPersonalizedDigestsTestCase(TestCase, SnubaTestCase):
    def setUp(self):
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
                    "timestamp": iso_format(before_now(minutes=1)),
                    "fingerprint": ["user4group1"],
                },
                project_id=self.project.id,
            ),
            self.store_event(
                data={
                    "stacktrace": {"frames": [{"lineno": 1, "filename": "bar.foo"}]},
                    "request": {"url": "helloworld.org"},
                    "timestamp": iso_format(before_now(minutes=1)),
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

    def create_events_from_filenames(
        self, project: Project, filenames: Sequence[str] | None = None
    ) -> list[Event]:
        return [
            self.store_event(
                data={
                    "stacktrace": {"frames": [{"filename": label}]},
                    "fingerprint": [label],
                    "timestamp": iso_format(before_now(minutes=1)),
                },
                project_id=project.id,
                assert_no_errors=False,
            )
            for index, label in enumerate(filenames or [])
        ]

    def test_simple(self):
        rule = self.project.rule_set.all()[0]
        records = [
            event_to_record(event, (rule,))
            for event in self.team1_events + self.team2_events + self.user4_events
        ]
        digest = build_digest(self.project, sort_records(records))[0]

        expected_result = {
            self.user1.actor_id: set(self.team1_events),
            self.user2.actor_id: set(self.team2_events),
            self.user3.actor_id: set(self.team1_events + self.team2_events),
            self.user4.actor_id: set(self.user4_events),
        }

        with self.feature("organizations:notification-all-recipients"):
            assert_get_personalized_digests(self.project, digest, expected_result)

    def test_direct_email(self):
        """When the action type is not Issue Owners, then the target actor gets a digest."""
        self.project_ownership.update(fallthrough=False)
        rule = self.project.rule_set.all()[0]
        records = [event_to_record(event, (rule,)) for event in self.team1_events]
        digest = build_digest(self.project, sort_records(records))[0]

        expected_result = {self.user1.actor_id: set(self.team1_events)}
        assert_get_personalized_digests(
            self.project, digest, expected_result, ActionTargetType.MEMBER, self.user1.id
        )

    def test_team_without_members(self):
        team = self.create_team()
        project = self.create_project(teams=[team], fire_project_created=True)
        ProjectOwnership.objects.create(
            project_id=project.id,
            schema=dump_schema([Rule(Matcher("path", "*.cpp"), [Owner("team", team.slug)])]),
            fallthrough=True,
        )
        rule = project.rule_set.all()[0]
        records = [
            event_to_record(event, (rule,))
            for event in self.create_events_from_filenames(
                project, ["hello.py", "goodbye.py", "hola.py", "adios.py"]
            )
        ]
        digest = build_digest(project, sort_records(records))[0]
        user_ids = [member.user_id for member in team.member_set]
        assert not user_ids
        participants_by_provider_by_event = get_participants_by_event(digest, project)
        assert not {
            actor for actors in participants_by_provider_by_event.values() for actor in actors
        }  # no users in this team no digests should be processed

    def test_only_everyone(self):
        rule = self.project.rule_set.all()[0]
        events = self.create_events_from_filenames(
            self.project, ["hello.moz", "goodbye.moz", "hola.moz", "adios.moz"]
        )
        records = [event_to_record(event, (rule,)) for event in events]
        digest = build_digest(self.project, sort_records(records))[0]
        expected_result = {
            self.user1.actor_id: set(events),
            self.user2.actor_id: set(events),
            self.user3.actor_id: set(events),
            self.user4.actor_id: set(events),
            self.user5.actor_id: set(events),
        }
        assert_get_personalized_digests(self.project, digest, expected_result)

    def test_everyone_with_owners(self):
        rule = self.project.rule_set.all()[0]
        events = self.create_events_from_filenames(
            self.project, ["hello.moz", "goodbye.moz", "hola.moz", "adios.moz"]
        )
        records = [event_to_record(event, (rule,)) for event in events + self.team1_events]
        digest = build_digest(self.project, sort_records(records))[0]
        expected_result = {
            self.user1.actor_id: set(events + self.team1_events),
            self.user2.actor_id: set(events),
            self.user3.actor_id: set(events + self.team1_events),
            self.user4.actor_id: set(events),
            self.user5.actor_id: set(events),
        }
        with self.feature("organizations:notification-all-recipients"):
            assert_get_personalized_digests(self.project, digest, expected_result)

    def test_empty_records(self):
        assert build_digest(self.project, []) == (None, [])
