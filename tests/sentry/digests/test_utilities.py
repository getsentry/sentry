from __future__ import absolute_import

from sentry.api.fields.actor import Actor
from sentry.digests.notifications import build_digest, event_to_record
from sentry.digests.utilities import (
    build_events_by_actor,
    convert_actors_to_users,
    get_event_from_groups_in_digest,
    get_personalized_digests,
    team_actors_to_user_ids,
)
from sentry.mail.adapter import ActionTargetType
from sentry.models import OrganizationMemberTeam, ProjectOwnership, Team, User
from sentry.ownership.grammar import Rule, Owner, Matcher, dump_schema
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


def sort_records(records):
    """
    Sorts records for fetch_state method
    fetch_state is expecting these records to be ordered from newest to oldest
    """
    return sorted(records, key=lambda r: r.value.event.datetime, reverse=True)


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
        )

        events.pop(0)  # remove event with same group
        assert set([e.event_id for e in get_event_from_groups_in_digest(digest)]) == set(
            [e.event_id for e in events]
        )

    def test_team_actors_to_user_ids(self):
        team1 = self.create_team()
        team2 = self.create_team()
        team3 = self.create_team()  # team with no active members
        users = [self.create_user() for i in range(0, 8)]

        self.create_member(user=users[0], organization=self.organization, teams=[team1])
        self.create_member(user=users[1], organization=self.organization, teams=[team1])
        self.create_member(user=users[2], organization=self.organization, teams=[team1])
        self.create_member(user=users[3], organization=self.organization, teams=[team1, team2])
        self.create_member(user=users[4], organization=self.organization, teams=[team2, self.team])
        self.create_member(user=users[5], organization=self.organization, teams=[team2])

        # Inactive member
        member6 = self.create_member(
            user=users[6], organization=self.organization, teams=[team2, team3]
        )
        team_member6 = OrganizationMemberTeam.objects.filter(organizationmember_id=member6.id)
        for team_member in team_member6:
            team_member.update(is_active=False)
        # Member without teams
        self.create_member(user=users[7], organization=self.organization, teams=[])

        team_actors = [Actor(team1.id, Team), Actor(team2.id, Team), Actor(team3.id, Team)]
        user_ids = [user.id for user in users]

        assert team_actors_to_user_ids(team_actors, user_ids) == {
            team1.id: set([users[0].id, users[1].id, users[2].id, users[3].id]),
            team2.id: set([users[3].id, users[4].id, users[5].id]),
        }

    def test_convert_actors_to_user_set(self):
        user1 = self.create_user()
        user2 = self.create_user()
        user3 = self.create_user()
        user4 = self.create_user()

        team1 = self.create_team()
        team2 = self.create_team()

        self.create_member(user=user1, organization=self.organization, teams=[team1])
        self.create_member(user=user2, organization=self.organization, teams=[team2])
        self.create_member(user=user3, organization=self.organization, teams=[team1, team2])
        self.create_member(user=user4, organization=self.organization, teams=[])

        team1_events = set(
            [
                self.create_event(self.project.id),
                self.create_event(self.project.id),
                self.create_event(self.project.id),
                self.create_event(self.project.id),
            ]
        )
        team2_events = set(
            [
                self.create_event(self.project.id),
                self.create_event(self.project.id),
                self.create_event(self.project.id),
                self.create_event(self.project.id),
            ]
        )
        user4_events = set([self.create_event(self.project.id), self.create_event(self.project.id)])
        events_by_actor = {
            Actor(team1.id, Team): team1_events,
            Actor(team2.id, Team): team2_events,
            Actor(user3.id, User): team1_events.union(team2_events),
            Actor(user4.id, User): user4_events,
        }
        user_by_events = {
            user1.id: team1_events,
            user2.id: team2_events,
            user3.id: team1_events.union(team2_events),
            user4.id: user4_events,
        }
        assert convert_actors_to_users(events_by_actor, user_by_events.keys()) == user_by_events


class GetPersonalizedDigestsTestCase(TestCase, SnubaTestCase):
    def setUp(self):
        super(GetPersonalizedDigestsTestCase, self).setUp()
        self.user1 = self.create_user()
        self.user2 = self.create_user()
        self.user3 = self.create_user()
        self.user4 = self.create_user()
        self.user5 = self.create_user()  # this user has no events
        self.user_ids = [self.user1.id, self.user2.id, self.user3.id, self.user4.id, self.user5.id]

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

    def create_events_from_filenames(self, project, filenames=None):
        events = []
        for index, label in enumerate(filenames):
            event_data = {
                "stacktrace": {"frames": [{"filename": label}]},
                "fingerprint": [label],
                "timestamp": iso_format(before_now(minutes=1)),
            }
            event = self.store_event(data=event_data, project_id=project.id, assert_no_errors=False)
            events.append(event)
        return events

    def assert_get_personalized_digests(
        self, project, digest, user_ids, expected_result, target_type=ActionTargetType.ISSUE_OWNERS
    ):
        result_user_ids = []
        for user_id, user_digest in get_personalized_digests(
            target_type, project.id, digest, user_ids
        ):
            assert user_id in expected_result
            assert set([e.event_id for e in get_event_from_groups_in_digest(user_digest)]) == set(
                [e.event_id for e in expected_result[user_id]]
            )
            result_user_ids.append(user_id)

        assert sorted(expected_result.keys()) == sorted(result_user_ids)

    def test_build_events_by_actor(self):
        events = self.team1_events + self.team2_events + self.user4_events

        events_by_actor = {
            Actor(self.team1.id, Team): set(self.team1_events),
            Actor(self.team2.id, Team): set(self.team2_events),
            Actor(self.user3.id, User): set(self.team1_events),
            Actor(self.user4.id, User): set(self.user4_events),
        }
        assert build_events_by_actor(self.project.id, events, self.user_ids) == events_by_actor

    def test_simple(self):
        rule = self.project.rule_set.all()[0]
        records = [
            event_to_record(event, (rule,))
            for event in self.team1_events + self.team2_events + self.user4_events
        ]
        digest = build_digest(self.project, sort_records(records))

        expected_result = {
            self.user1.id: set(self.team1_events),
            self.user2.id: set(self.team2_events),
            self.user3.id: set(self.team1_events + self.team2_events),
            self.user4.id: set(self.user4_events),
        }
        self.assert_get_personalized_digests(self.project, digest, self.user_ids, expected_result)

    def test_direct_email(self):
        self.project_ownership.update(fallthrough=False)
        rule = self.project.rule_set.all()[0]
        records = [event_to_record(event, (rule,)) for event in self.team1_events]
        digest = build_digest(self.project, sort_records(records))

        expected_result = {self.user1.id: set(self.team1_events)}
        self.assert_get_personalized_digests(
            self.project, digest, [self.user1.id], expected_result, ActionTargetType.MEMBER
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
        digest = build_digest(project, sort_records(records))
        user_ids = [member.user_id for member in team.member_set]
        assert not user_ids
        for user_id, user_digest in get_personalized_digests(
            ActionTargetType.ISSUE_OWNERS, project.id, digest, user_ids
        ):
            assert False  # no users in this team no digests should be processed

    def test_only_everyone(self):
        rule = self.project.rule_set.all()[0]
        events = self.create_events_from_filenames(
            self.project, ["hello.moz", "goodbye.moz", "hola.moz", "adios.moz"]
        )
        records = [event_to_record(event, (rule,)) for event in events]
        digest = build_digest(self.project, sort_records(records))
        expected_result = {
            self.user1.id: set(events),
            self.user2.id: set(events),
            self.user3.id: set(events),
            self.user4.id: set(events),
            self.user5.id: set(events),
        }
        self.assert_get_personalized_digests(self.project, digest, self.user_ids, expected_result)

    def test_everyone_with_owners(self):
        rule = self.project.rule_set.all()[0]
        events = self.create_events_from_filenames(
            self.project, ["hello.moz", "goodbye.moz", "hola.moz", "adios.moz"]
        )
        records = [event_to_record(event, (rule,)) for event in events + self.team1_events]
        digest = build_digest(self.project, sort_records(records))
        expected_result = {
            self.user1.id: set(events + self.team1_events),
            self.user2.id: set(events),
            self.user3.id: set(events + self.team1_events),
            self.user4.id: set(events),
            self.user5.id: set(events),
        }
        self.assert_get_personalized_digests(self.project, digest, self.user_ids, expected_result)
