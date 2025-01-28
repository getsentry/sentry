from datetime import timedelta

from django.utils import timezone

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.models.action_group_status import ActionGroupStatus


class TestActionGroupStatus(TestCase):
    def test_change_date_updated(self):
        now = timezone.now() + timedelta(days=1)
        action = self.create_action(type=Action.Type.EMAIL, data={})
        status = ActionGroupStatus.objects.create(action=action, group=self.group)

        assert status.date_updated != now
        status.update(date_updated=now)
        status.refresh_from_db()
        assert status.date_updated == now
