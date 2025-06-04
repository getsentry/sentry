from rest_framework import serializers

from sentry.api.serializers.rest_framework import JSONField
from sentry.testutils.cases import TestCase


class DummySerializer(serializers.Serializer):
    json_field = JSONField()


class JSONFieldTest(TestCase):
    def test_invalid_json(self):
        data = object()
        serializer = DummySerializer(data={"json_field": data})
        assert serializer.is_valid() is False
        assert serializer.errors == {"json_field": ["Value must be valid JSON."]}

    def test_valid_json(self):
        data = {
            "id": "1234",
            "name": "json-tester",
            "actions": [{"say-hello": "hello world"}, {"say-goodbye": "bye"}],
        }

        serializer = DummySerializer(data={"json_field": data})
        assert serializer.is_valid()
        assert serializer.validated_data == {
            "json_field": {
                "id": "1234",
                "name": "json-tester",
                "actions": [{"say-hello": "hello world"}, {"say-goodbye": "bye"}],
            }
        }
