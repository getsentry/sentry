from contextlib import contextmanager
from unittest import mock

from sentry.models.group import Group
from sentry.signals import post_update
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options


@contextmanager
def catch_signal(signal):
    handler = mock.Mock()
    signal.connect(handler)
    yield handler
    signal.disconnect(handler)


class TestSendPostUpdateSignal(TestCase):
    def test_not_triggered(self):
        with catch_signal(post_update) as handler, override_options(
            {"groups.enable-post-update-signal": True}
        ):
            self.group.message = "hi"
            self.group.save()

        assert not handler.called

        with catch_signal(post_update) as handler, override_options(
            {"groups.enable-post-update-signal": True}
        ):
            self.group.update(message="hi")

        assert not handler.called

        with catch_signal(post_update) as handler, override_options(
            {"groups.enable-post-update-signal": False}
        ):
            Group.objects.filter(id=self.group.id).update(message="hi")

        assert not handler.called

        with catch_signal(post_update) as handler, override_options(
            {"groups.enable-post-update-signal": True}
        ):
            Group.objects.filter(id=self.group.id).enable_post_update_signal(False).update(
                message="hi"
            )

        assert not handler.called

    def test_enable(self):
        qs = Group.objects.all()
        assert not qs._send_post_update_signal
        new_qs = qs.enable_post_update_signal(True)
        # Make sure we don't modify the previous queryset
        assert not qs._send_post_update_signal
        assert new_qs._send_post_update_signal

    def test_triggered(self):
        message = "hi"
        with catch_signal(post_update) as handler, override_options(
            {"groups.enable-post-update-signal": True}
        ):
            Group.objects.filter(id=self.group.id).update(message=message)

        self.group.refresh_from_db()
        assert self.group.message == message
        handler.assert_called_once_with(
            signal=post_update,
            sender=Group,
            updated_fields=["message"],
            model_ids=[self.group.id],
        )
