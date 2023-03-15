from unittest import mock

import pytest
import sentry_sdk
from django.conf import settings
from django.db import connection, models

from sentry.db.models.fields import picklefield
from sentry.testutils import TestCase


class JsonReadingPickleModel(models.Model):
    data = picklefield.PickledObjectField(write_json=False)

    class Meta:
        app_label = "fixtures"


class JsonWritingPickleModel(models.Model):
    data = picklefield.PickledObjectField(write_json=True)

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

    def test_to_python_int(self):
        obj = picklefield.PickledObjectField(write_json=False)
        assert obj.to_python(9) == 9

    def test_to_python_bool(self):
        obj = picklefield.PickledObjectField(write_json=False)
        assert obj.to_python(True) is True


@pytest.fixture
def complain_enabled():
    with mock.patch.object(settings, "PICKLED_OBJECT_FIELD_COMPLAIN_ABOUT_BAD_USE_OF_PICKLE", True):
        yield


@pytest.fixture
def complain_disabled_sample_100_percent():
    with mock.patch.object(
        settings, "PICKLED_OBJECT_FIELD_COMPLAIN_ABOUT_BAD_USE_OF_PICKLE", False
    ):
        with mock.patch.object(picklefield, "VALIDATE_JSON_SAMPLE_RATE", 1):
            yield


@pytest.fixture
def complain_disabled_sample_disabled():
    with mock.patch.object(
        settings, "PICKLED_OBJECT_FIELD_COMPLAIN_ABOUT_BAD_USE_OF_PICKLE", False
    ):
        with mock.patch.object(picklefield, "VALIDATE_JSON_SAMPLE_RATE", 0):
            yield


@pytest.fixture
def fake_capture_exception():
    with mock.patch.object(sentry_sdk, "capture_exception") as mck:
        yield mck


@pytest.mark.usefixtures("complain_enabled")
def test_non_serializable_error_when_setting_enabled():
    with pytest.raises(TypeError) as excinfo:
        picklefield.PickledObjectField().get_db_prep_value({"hello": b"\xef"})

    (msg,) = excinfo.value.args
    assert msg == "Tried to serialize a pickle field with a value that cannot be serialized as JSON"


@pytest.mark.usefixtures("complain_enabled")
def test_non_roundtrip_when_setting_enabled():
    with pytest.raises(TypeError) as excinfo:
        picklefield.PickledObjectField().get_db_prep_value(())

    (msg,) = excinfo.value.args
    assert msg == (
        "json serialized database value was not the same after deserializing:\n"
        "- type(o)=<class 'tuple'>\n"
        "- type(rt)=<class 'list'>"
    )


@pytest.mark.usefixtures("complain_disabled_sample_100_percent")
def test_sampling_is_nonfatal(fake_capture_exception):
    v = picklefield.PickledObjectField().get_db_prep_value({"hello": b"\xef"})

    # it got pickled
    assert (
        v
        == "gAJ9cQBYBQAAAGhlbGxvcQFjX2NvZGVjcwplbmNvZGUKcQJYAgAAAMOvcQNYBgAAAGxhdGluMXEEhnEFUnEGcy4="
    )

    assert fake_capture_exception.call_count == 1
    (e,), _ = fake_capture_exception.call_args
    (msg,) = e.args
    assert msg == "Tried to serialize a pickle field with a value that cannot be serialized as JSON"


@pytest.mark.usefixtures("complain_disabled_sample_disabled")
def test_no_error_or_logging_when_disabled(fake_capture_exception):
    v = picklefield.PickledObjectField().get_db_prep_value({"hello": b"\xef"})

    # it got pickled
    assert (
        v
        == "gAJ9cQBYBQAAAGhlbGxvcQFjX2NvZGVjcwplbmNvZGUKcQJYAgAAAMOvcQNYBgAAAGxhdGluMXEEhnEFUnEGcy4="
    )

    assert fake_capture_exception.call_count == 0
