from django.db import models

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedIntegerField,
    BoundedPositiveIntegerField,
    Model,
)
from sentry.testutils import TestCase


# There's a good chance this model wont get created in the db, so avoid
# assuming it exists in these tests.
class DummyModel(Model):
    __include_in_export__ = False  # needs defined for Sentry to not yell at you

    foo = models.CharField(max_length=32)
    normint = BoundedIntegerField(null=True)
    bigint = BoundedBigIntegerField(null=True)
    posint = BoundedPositiveIntegerField(null=True)


class ModelTest(TestCase):
    def test_large_int(self):
        with self.assertRaises(AssertionError):
            DummyModel.objects.create(normint=int(9223372036854775807), foo="bar")

        with self.assertRaises(AssertionError):
            DummyModel.objects.create(bigint=int(9223372036854775808), foo="bar")

        with self.assertRaises(AssertionError):
            DummyModel.objects.create(posint=int(9223372036854775808), foo="bar")
