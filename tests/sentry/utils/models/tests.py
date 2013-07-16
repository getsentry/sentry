from __future__ import absolute_import

from django.db import models

from sentry.models import Option
from sentry.testutils import TestCase
from sentry.utils.models import (
    Model, BoundedIntegerField, BoundedBigIntegerField,
    BoundedPositiveIntegerField, create_or_update)


# There's a good chance this model wont get created in the db, so avoid
# assuming it exists in these tests.
class DummyModel(Model):
    foo = models.CharField(max_length=32)
    normint = BoundedIntegerField(null=True)
    bigint = BoundedBigIntegerField(null=True)
    posint = BoundedPositiveIntegerField(null=True)


class ModelTest(TestCase):
    def test_foo_hasnt_changed_on_init(self):
        inst = DummyModel(id=1, foo='bar')
        self.assertFalse(inst.has_changed('foo'))

    def test_foo_has_changes_before_save(self):
        inst = DummyModel(id=1, foo='bar')
        inst.foo = 'baz'
        self.assertTrue(inst.has_changed('foo'))
        self.assertEquals(inst.old_value('foo'), 'bar')

    def test_foo_hasnt_changed_after_save(self):
        inst = DummyModel(id=1, foo='bar')
        inst.foo = 'baz'
        self.assertTrue(inst.has_changed('foo'))
        self.assertEquals(inst.old_value('foo'), 'bar')
        models.signals.post_save.send(instance=inst, sender=type(inst), created=False)
        self.assertFalse(inst.has_changed('foo'))

    def test_large_int(self):
        with self.assertRaises(AssertionError):
            DummyModel.objects.create(normint=9223372036854775807L, foo='bar')

        with self.assertRaises(AssertionError):
            DummyModel.objects.create(id=9223372036854775807L, foo='bar')

        with self.assertRaises(AssertionError):
            DummyModel.objects.create(bigint=9223372036854775808L, foo='bar')

        with self.assertRaises(AssertionError):
            DummyModel.objects.create(posint=9223372036854775808L, foo='bar')


class CreateOrUpdateTest(TestCase):
    def test_basic_flow(self):
        assert not Option.objects.filter(key='foo').exists()

        result, created = create_or_update(Option, key='foo', values={
            'value': 'bar',
        })

        assert created is True
        assert type(result) is Option
        assert result.key == 'foo'
        assert result.value == 'bar'

        result, created = create_or_update(Option, key='foo', values={
            'value': 'baz',
        })

        assert created is False
        assert result == 1

        row = Option.objects.get(key='foo')
        assert row.value == 'baz'
