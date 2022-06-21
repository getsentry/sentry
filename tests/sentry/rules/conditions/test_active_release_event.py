from sentry.eventstore import Filter
from sentry.eventstore.snuba import SnubaEventStorage
from sentry.models import Group, Rule
from sentry.rules.conditions.active_release import ActiveReleaseEventCondition
from sentry.testutils import RuleTestCase, SnubaTestCase


class ActiveReleaseEventConditionTest(SnubaTestCase, RuleTestCase):
    rule_cls = ActiveReleaseEventCondition

    def setUp(self):
        super().setUp()
        self.eventstore = SnubaEventStorage()

    def test_applies_correctly(self):
        rule = self.get_rule(rule=Rule(environment_id=1))

        self.assertDoesNotPass(rule, self.event, is_new=True)

    # XXX(gilbert): delete this later
    def test_event_group_last_release_version(self):
        evt = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "\u3053\u3093\u306b\u3061\u306f",
            },
            project_id=self.project.id,
        )
        evt2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "\u3053\u3093\u306b\u3061\u306f",
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

        rule = self.get_rule(rule=Rule(environment_id=1))

        self.assertDoesNotPass(rule, evt, is_new=True)
