import pytest

from sentry.constants import ObjectStatus
from sentry.models import Rule
from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("Migration is no longer runnable. Retain until migration is removed.")
class MigrateNoActionDupleIssueAlerts(TestMigrations):
    migrate_from = "0548_add_is_unclaimed_boolean_to_user"
    migrate_to = "0549_migrate_no_action_dupe_issue_alerts"

    def setup_initial_state(self):
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
            }
        ]
        self.no_action_rule = Rule.objects.create(
            project=self.project,
            data={"conditions": conditions, "action_match": "all"},
        )
        actions = [
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
            }
        ]
        self.non_migrated_rule = Rule.objects.create(
            project=self.project,
            data={"conditions": conditions, "actions": actions, "action_match": "all"},
        )

        self.duplicate_rule = Rule.objects.create(
            project=self.project,
            data={"conditions": conditions, "actions": actions, "action_match": "all"},
        )

    def test(self):
        assert self.no_action_rule == ObjectStatus.ACTIVE
        assert self.duplicate_rule.status == ObjectStatus.ACTIVE
        assert self.non_migrated_rule == ObjectStatus.ACTIVE
        self.self.no_action_rule.refresh_from_db()
        self.duplicate_rule.refresh_from_db()
        assert self.no_action_rule == ObjectStatus.DISABLED
        assert self.duplicate_rule.status == ObjectStatus.DISABLED
        assert self.non_migrated_rule == ObjectStatus.ACTIVE
