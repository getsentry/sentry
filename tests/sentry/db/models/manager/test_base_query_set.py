from contextlib import contextmanager
from unittest import mock

from sentry.models.group import Group
from sentry.signals import post_update
from sentry.testutils.cases import TestCase


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
        update_call_args = [(post_update, Group, ["message"], [self.group.id])]
        with catch_signal(post_update) as handler:
            self.group.message = "hi"
            self.group.save()

        assert update_call_args not in handler.call_args_list

        with catch_signal(post_update) as handler:
            self.group.update(message="hi")

        assert update_call_args not in handler.call_args_list

        # Test signal not fired when Django detects the query will return no results
        with catch_signal(post_update) as handler:
            assert Group.objects.filter(id__in=[]).update(message="hi") == 0

        assert update_call_args not in handler.call_args_list

    def test_triggered(self):
        message = "hi"
        with (catch_signal(post_update) as handler,):
            assert Group.objects.filter(id=self.group.id).update(message=message) == 1

        self.group.refresh_from_db()
        assert self.group.message == message
        handler.assert_any_call(
            signal=post_update,
            sender=Group,
            updated_fields=["message"],
            model_ids=[self.group.id],
        )
