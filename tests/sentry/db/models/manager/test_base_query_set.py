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


class TestUpdateWithReturning(TestCase):
    def test(self):
        group_2 = self.create_group()
        ids = [self.group.id, group_2.id]
        returned = Group.objects.filter(id__in=ids).update_with_returning(
            returned_fields=["id"], message="hi"
        )
        assert {r[0] for r in returned} == set(ids)
        returned = Group.objects.filter(id=self.group.id).update_with_returning(
            returned_fields=["id"], message="hi"
        )
        assert [r[0] for r in returned] == [self.group.id]
        returned = Group.objects.filter(id__in=ids).update_with_returning(
            returned_fields=["id", "message"], message="hi"
        )
        assert {r for r in returned} == {(id_, "hi") for id_ in ids}

    def test_empty_query(self):
        assert [] == Group.objects.filter(id__in=[]).update_with_returning(
            returned_fields=["id"], message="hi"
        )


class TestSendPostUpdateSignal(TestCase):
    def test_not_triggered(self):
        with (
            catch_signal(post_update) as handler,
            override_options({"groups.enable-post-update-signal": True}),
        ):
            self.group.message = "hi"
            self.group.save()

        assert not handler.called

        with (
            catch_signal(post_update) as handler,
            override_options({"groups.enable-post-update-signal": True}),
        ):
            self.group.update(message="hi")

        assert not handler.called

        with (
            catch_signal(post_update) as handler,
            override_options({"groups.enable-post-update-signal": False}),
        ):
            assert Group.objects.filter(id=self.group.id).update(message="hi") == 1

        assert not handler.called

        with (
            catch_signal(post_update) as handler,
            override_options({"groups.enable-post-update-signal": True}),
        ):
            assert (
                Group.objects.filter(id=self.group.id)
                .with_post_update_signal(False)
                .update(message="hi")
                == 1
            )

        assert not handler.called

        # Test signal not fired when Django detects the query will return no results
        with (
            catch_signal(post_update) as handler,
            override_options({"groups.enable-post-update-signal": True}),
        ):
            assert (
                Group.objects.filter(id__in=[]).with_post_update_signal(True).update(message="hi")
                == 0
            )

        assert not handler.called

    def test_enable(self):
        qs = Group.objects.all()
        assert not qs._with_post_update_signal
        new_qs = qs.with_post_update_signal(True)
        # Make sure we don't modify the previous queryset
        assert not qs._with_post_update_signal
        assert new_qs._with_post_update_signal

    def test_triggered(self):
        message = "hi"
        with (
            catch_signal(post_update) as handler,
            override_options({"groups.enable-post-update-signal": True}),
        ):
            assert Group.objects.filter(id=self.group.id).update(message=message) == 1

        self.group.refresh_from_db()
        assert self.group.message == message
        handler.assert_called_once_with(
            signal=post_update,
            sender=Group,
            updated_fields=["message"],
            model_ids=[self.group.id],
        )
