from datetime import datetime, timedelta

from django.utils import timezone

from sentry.eventstore import Filter
from sentry.eventstore.snuba import SnubaEventStorage
from sentry.models import Deploy, Group, Release, Rule
from sentry.rules.conditions.active_release import ActiveReleaseEventCondition
from sentry.testutils import RuleTestCase, SnubaTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ActiveReleaseEventConditionTest(SnubaTestCase, RuleTestCase):
    rule_cls = ActiveReleaseEventCondition

    def setUp(self):
        super().setUp()
        self.eventstore = SnubaEventStorage()

    def test_applies_correctly(self):
        rule = self.get_rule()

        self.assertDoesNotPass(rule, self.event, is_new=True)

    def test_release_date_released(self):
        event = self.get_event()
        oldRelease = Release.objects.create(
            organization_id=self.organization.id,
            version="1",
            date_added=timezone.now() - timedelta(hours=2),
            date_released=timezone.now() - timedelta(hours=2),
        )
        newRelease = Release.objects.create(
            organization_id=self.organization.id,
            version="2",
            date_added=timezone.now() - timedelta(minutes=30),
            date_released=timezone.now() - timedelta(minutes=30),
        )
        oldRelease.add_project(self.project)
        newRelease.add_project(self.project)

        event.data["tags"] = (("sentry:release", newRelease.version),)
        rule = self.get_rule()
        self.assertPasses(rule, event)

    def test_release_deployed(self):
        event = self.get_event()
        newRelease = Release.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            version="2",
            date_added=timezone.now() - timedelta(days=1),
            date_released=None,
        )
        Deploy.objects.create(
            organization_id=self.organization.id,
            environment_id=self.environment.id,
            name="test_release_deployed",
            notified=True,
            release_id=newRelease.id,
            date_started=timezone.now() - timedelta(minutes=37),
            date_finished=timezone.now() - timedelta(minutes=20),
        )
        newRelease.add_project(self.project)

        event.data["tags"] = (("sentry:release", newRelease.version),)
        rule = self.get_rule()
        self.assertPasses(rule, event)

    def test_release_project_env(self):
        pass

    def test_release_env(self):
        pass

    # XXX(gilbert): delete this later
    def test_event_group_last_release_version(self):
        oldRelease = Release.objects.create(
            organization_id=self.organization.id,
            version="1",
            date_added=datetime(2020, 9, 1, 3, 8, 24, 880386),
        )
        oldRelease.add_project(self.project)

        newRelease = Release.objects.create(
            organization_id=self.organization.id,
            version="2",
            date_added=datetime(2020, 9, 1, 3, 8, 24, 880386),
        )
        newRelease.add_project(self.project)

        evt = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "\u3053\u3093\u306b\u3061\u306f",
                "tags": (("sentry:release", newRelease.version),),
            },
            project_id=self.project.id,
        )
        evt2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "\u3053\u3093\u306b\u3061\u306f",
                "tags": (("sentry:release", newRelease.version),),
            },
            project_id=self.project.id,
        )

        evts = self.eventstore.get_events(
            filter=Filter(
                project_ids=[self.project.id],
                event_ids=[evt.event_id, evt2.event_id],
            )
        )

        assert len(evts) == 2

        assert evt.event_id != evt2.event_id
        assert list(
            Group.objects.filter(id__in=(evt.group_id, evt2.group_id)).values_list("id", flat=True)
        ) == [evt.group_id]

        # assert GroupRelease.objects.all().count() == 1
        rule = self.get_rule(rule=Rule(environment_id=self.environment.id))

        self.assertDoesNotPass(rule, evt)

        # self.assertDoesNotPass(rule, evt, is_new=True)
