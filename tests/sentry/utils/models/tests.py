from __future__ import absolute_import

from django.db import models
from sentry.db.models import (
    Model,
    BoundedIntegerField,
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
)
from sentry.testutils import TestCase


# There's a good chance this model wont get created in the db, so avoid
# assuming it exists in these tests.
class DummyModel(Model):
    __core__ = False  # needs defined for Sentry to not yell at you

    foo = models.CharField(max_length=32)
    normint = BoundedIntegerField(null=True)
    bigint = BoundedBigIntegerField(null=True)
    posint = BoundedPositiveIntegerField(null=True)


class ModelTest(TestCase):
    def test_foo_hasnt_changed_on_init(self):
        inst = DummyModel(id=1, foo="bar")
        self.assertFalse(inst.has_changed("foo"))

    def test_foo_has_changes_before_save(self):
        inst = DummyModel(id=1, foo="bar")
        inst.foo = "baz"
        self.assertTrue(inst.has_changed("foo"))
        self.assertEquals(inst.old_value("foo"), "bar")

    def test_foo_hasnt_changed_after_save(self):
        inst = DummyModel(id=1, foo="bar")
        inst.foo = "baz"
        self.assertTrue(inst.has_changed("foo"))
        self.assertEquals(inst.old_value("foo"), "bar")
        models.signals.post_save.send(instance=inst, sender=type(inst), created=False)
        self.assertFalse(inst.has_changed("foo"))

    def test_large_int(self):
        with self.assertRaises(AssertionError):
            DummyModel.objects.create(normint=int(9223372036854775807), foo="bar")

        with self.assertRaises(AssertionError):
            DummyModel.objects.create(bigint=int(9223372036854775808), foo="bar")

        with self.assertRaises(AssertionError):
            DummyModel.objects.create(posint=int(9223372036854775808), foo="bar")
