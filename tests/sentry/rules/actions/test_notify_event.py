from mock import patch

from sentry.testutils.cases import RuleTestCase
from sentry.rules.actions.notify_event import NotifyEventAction


class NotifyEventActionTest(RuleTestCase):
    rule_cls = NotifyEventAction

    @patch('sentry.plugins.sentry_mail.models.MailPlugin.notify')
    def test_applies_correctly(self, mail_notify_users):
        event = self.get_event()

        rule = self.get_rule()
        rule.after(event=event, state=self.get_state())

        mail_notify_users.assert_called_once()
