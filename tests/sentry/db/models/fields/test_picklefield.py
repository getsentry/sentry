from django.db import connection, models

from sentry.db.models.fields.picklefield import PickledObjectField
from sentry.testutils import TestCase


class JsonReadingPickleModel(models.Model):
    data = PickledObjectField(write_json=False)

    class Meta:
        app_label = "fixtures"


class JsonWritingPickleModel(models.Model):
    data = PickledObjectField(write_json=True)

    class Meta:
        app_label = "fixtures"


class PickledObjectFieldTest(TestCase):
    def test_pickle_by_default(self):
        obj = JsonReadingPickleModel.objects.create(
            data={"foo": "bar"},
        )
        obj = JsonReadingPickleModel.objects.get(id=obj.id)
        self.assertEqual(obj.data, {"foo": "bar"})

        with connection.cursor() as cur:
            cur.execute("select * from fixtures_jsonreadingpicklemodel where id = %s", [obj.id])
            row = cur.fetchone()

            # pickled, since we still write pickle in this case
            assert row[1] == "gAJ9cQBYAwAAAGZvb3EBWAMAAABiYXJxAnMu"

            # put some JSON there
            cur.execute(
                "update fixtures_jsonreadingpicklemodel set data = %s where id = %s",
                ['{"foo": "bar2"}', obj.id],
            )

        # we observe the update as json
        obj = JsonReadingPickleModel.objects.get(id=obj.id)
        self.assertEqual(obj.data, {"foo": "bar2"})

    def test_json_by_default(self):
        obj = JsonWritingPickleModel.objects.create(
            data={"foo": "bar2"},
        )
        obj = JsonWritingPickleModel.objects.get(id=obj.id)
        self.assertEqual(obj.data, {"foo": "bar2"})

        with connection.cursor() as cur:
            cur.execute("select * from fixtures_jsonwritingpicklemodel where id = %s", [obj.id])
            row = cur.fetchone()

            # should be JSON
            assert row[1] == '{"foo":"bar2"}'

            # put some pickle there
            cur.execute(
                "update fixtures_jsonwritingpicklemodel set data = %s where id = %s",
                ["gAJ9cQBYAwAAAGZvb3EBWAMAAABiYXJxAnMu", obj.id],
            )

        # we observe the update as pickle
        obj = JsonWritingPickleModel.objects.get(id=obj.id)
        self.assertEqual(obj.data, {"foo": "bar"})
