import pytest
from django.db import models

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


def test_to_python_int():
    obj = picklefield.PickledObjectField()
    assert obj.to_python(9) == 9


def test_to_python_bool():
    obj = picklefield.PickledObjectField()
    assert obj.to_python(True) is True
