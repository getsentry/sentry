from contextlib import contextmanager
from unittest import mock

import pytest

from sentry.models.group import Group
from sentry.signals import post_update
from sentry.testutils.cases import TestCase


@contextmanager
def catch_signal(signal):
    handler = mock.Mock()
    signal.connect(handler)
    yield handler
    signal.disconnect(handler)


class TestGetOrNone(TestCase):
    def test_found(self) -> None:
        assert Group.objects.get_or_none(id=self.group.id) == self.group

    def test_missing(self) -> None:
        assert Group.objects.get_or_none(id=0) is None

    def test_multiple_raises(self) -> None:
        other = self.create_group()
        with pytest.raises(Group.MultipleObjectsReturned):
            Group.objects.filter(id__in=[self.group.id, other.id]).get_or_none()

    def test_values_list(self) -> None:
        assert (
            Group.objects.filter(id=self.group.id).values_list("id", flat=True).get_or_none()
            == self.group.id
        )
        assert Group.objects.filter(id=0).values_list("id", flat=True).get_or_none() is None


class TestUpdateWithReturning(TestCase):
    def test(self) -> None:
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

    def test_empty_query(self) -> None:
        assert [] == Group.objects.filter(id__in=[]).update_with_returning(
            returned_fields=["id"], message="hi"
        )

    def test_raises_when_no_fields_returned(self) -> None:
        original_message = self.group.message

        queryset = Group.objects.filter(id=self.group.id)

        with pytest.raises(ValueError, match="at least one field"):
            queryset.update_with_returning(returned_fields=[], message="hi")

        self.group.refresh_from_db()

        assert self.group.message == original_message

    def test_sends_post_update_signal_with_ids_from_returned_rows(self) -> None:
        queryset = Group.objects.filter(id=self.group.id).with_post_update_signal(True)

        with catch_signal(post_update) as handler:
            returned = queryset.update_with_returning(
                returned_fields=["id", "message"], message="hi"
            )

        assert returned == [(self.group.id, "hi")]

        handler.assert_called_once_with(
            signal=post_update,
            sender=Group,
            updated_fields=["message"],
            model_ids=[self.group.id],
        )

    def test_raises_when_signal_enabled_and_primary_key_not_returned(self) -> None:
        original_message = self.group.message

        queryset = Group.objects.filter(id=self.group.id).with_post_update_signal(True)

        with pytest.raises(ValueError, match="post_update"):
            queryset.update_with_returning(returned_fields=["message"], message="hi")

        self.group.refresh_from_db()

        assert self.group.message == original_message

    def test_raises_when_signal_enabled_and_primary_key_not_first(self) -> None:
        original_message = self.group.message

        queryset = Group.objects.filter(id=self.group.id).with_post_update_signal(True)

        with pytest.raises(ValueError, match="first field"):
            queryset.update_with_returning(returned_fields=["message", "id"], message="hi")

        self.group.refresh_from_db()

        assert self.group.message == original_message

    def test_no_signal_when_signal_disabled(self) -> None:
        queryset = Group.objects.filter(id=self.group.id).with_post_update_signal(False)

        with catch_signal(post_update) as handler:
            returned = queryset.update_with_returning(returned_fields=["message"], message="hi")

        assert returned == [("hi",)]

        assert not handler.called


class TestSendPostUpdateSignal(TestCase):
    def test_not_triggered(self) -> None:
        with catch_signal(post_update) as handler:
            self.group.message = "hi"
            self.group.save()

        assert not handler.called

        with catch_signal(post_update) as handler:
            self.group.update(message="hi")

        assert not handler.called

        with catch_signal(post_update) as handler:
            assert (
                Group.objects.filter(id=self.group.id)
                .with_post_update_signal(False)
                .update(message="hi")
                == 1
            )

        assert not handler.called

        # Test signal not fired when Django detects the query will return no results
        with catch_signal(post_update) as handler:
            assert (
                Group.objects.filter(id__in=[]).with_post_update_signal(True).update(message="hi")
                == 0
            )

        assert not handler.called

    def test_enable(self) -> None:
        qs = Group.objects.all().with_post_update_signal(False)
        assert not qs._with_post_update_signal
        new_qs = qs.with_post_update_signal(True)
        # Make sure we don't modify the previous queryset
        assert not qs._with_post_update_signal
        assert new_qs._with_post_update_signal

    def test_triggered(self) -> None:
        message = "hi"
        with catch_signal(post_update) as handler:
            assert Group.objects.filter(id=self.group.id).update(message=message) == 1

        self.group.refresh_from_db()
        assert self.group.message == message
        handler.assert_called_once_with(
            signal=post_update,
            sender=Group,
            updated_fields=["message"],
            model_ids=[self.group.id],
        )
