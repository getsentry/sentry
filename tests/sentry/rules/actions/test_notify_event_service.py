from mock import patch

from sentry.testutils.cases import RuleTestCase
from sentry.rules.actions.notify_event_service import NotifyEventServiceAction


class NotifyEventServiceActionTest(RuleTestCase):
    rule_cls = NotifyEventServiceAction

    @patch('sentry.plugins.sentry_mail.models.MailPlugin.notify_users')
    def test_applies_correctly(self, mail_notify_users):
        event = self.get_event()

        rule = self.get_rule({
            'service': 'mail',
        })
        rule.after(event=event, state=self.get_state())

        mail_notify_users.assert_called_once_with(group=event.group, event=event)
