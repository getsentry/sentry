from django.db import models

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedIntegerField,
    BoundedPositiveIntegerField,
    Model,
)
from sentry.db.models.manager import make_key
from sentry.sentry_metrics.indexer.models import StringIndexerManager
from sentry.testutils import TestCase
from sentry.utils.cache import cache


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


class DummyIndexer(Model):
    __include_in_export__ = False

    string = models.CharField(max_length=200)
    project_id = BoundedBigIntegerField()

    objects = StringIndexerManager(cache_fields=("project_id", "string"), cache_version=1)

    class Meta:
        db_table = "sentry_test2"
        app_label = "sentry"
        constraints = [
            models.UniqueConstraint(fields=["string", "project_id"], name="unique_project_string"),
        ]


class StringIndexerManagerTesting(TestCase):
    def _make_key(self, **kwargs):
        return make_key(DummyIndexer, "modelcache", kwargs)

    def test_caching(self):
        composite_key = "project_id:string"
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        obj1 = DummyIndexer.objects.create(string="hello", project_id=1)
        obj2 = DummyIndexer.objects.create(string="goodbye", project_id=2)
        obj3 = DummyIndexer.objects.create(string="sup", project_id=2)

        values = ["1:hello", "2:goodbye", "2:sup"]
        cache_keys = [self._make_key(**{composite_key: v}) for v in values]
        assert cache.get_many(cache_keys, version=1) == {}

        with CaptureQueriesContext(connection) as ctx:
            objs = DummyIndexer.objects.get_items_from_cache(
                values=values, composite_key="project_id:string"
            )
            assert [o.id for o in objs] == [obj1.id, obj2.id, obj3.id]
            assert len(cache.get_many(cache_keys, version=1)) == 3
            assert len(ctx.captured_queries) == 1

            objs_2 = DummyIndexer.objects.get_items_from_cache(
                values=values, composite_key="project_id:string"
            )
            assert [o.id for o in objs_2] == [obj1.id, obj2.id, obj3.id]
            # should only be one query since the second time should have
            # just used the cache
            assert len(ctx.captured_queries) == 1
