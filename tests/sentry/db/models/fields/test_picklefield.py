import pytest
from django.db import connection, models

from sentry.db.models.fields import picklefield


class JsonWritingPickleModel(models.Model):
    id = models.AutoField(primary_key=True)
    data = picklefield.PickledObjectField()

    class Meta:
        app_label = "fixtures"


@pytest.mark.django_db
def test_json_by_default():
    obj = JsonWritingPickleModel.objects.create(
        data={"foo": "bar2"},
    )
    obj = JsonWritingPickleModel.objects.get(id=obj.id)
    assert obj.data == {"foo": "bar2"}

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
    assert obj.data == {"foo": "bar"}


def test_to_python_int():
    obj = picklefield.PickledObjectField()
    assert obj.to_python(9) == 9


def test_to_python_bool():
    obj = picklefield.PickledObjectField()
    assert obj.to_python(True) is True
