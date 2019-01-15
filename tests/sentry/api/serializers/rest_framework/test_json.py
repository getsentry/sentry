from __future__ import absolute_import
from sentry.api.serializers.rest_framework import JSONField

from rest_framework import serializers

from sentry.testutils import TestCase


class DummySerializer(serializers.Serializer):
    json_field = JSONField(binary=False)


class DummyBinarySerializer(serializers.Serializer):
    json_field = JSONField(binary=True)


class JSONFieldTest(TestCase):
    def test_valid_binary_json(self):
        data = b'''{
            "id": "1234",
            "name": "json-tester",
            "actions": [{"say-hello": "hello world"}, {"say-goodbye": "bye"}]
        }'''

        serializer = DummyBinarySerializer(data={'json_field': data})
        assert serializer.is_valid()
        assert serializer.object == {
            'json_field': {
                'id': '1234',
                'name': 'json-tester',
                'actions': [{'say-hello': 'hello world'}, {'say-goodbye': 'bye'}]
            }
        }

    def test_invalid_binary_json(self):
        data = b'''{"I\'m just a string"}'''
        serializer = DummyBinarySerializer(data={'json_field': data})
        assert serializer.is_valid() is False
        assert serializer.errors == {'json_field': [u'Value must be valid JSON.']}
        assert serializer.object is None

    def test_valid_json(self):
        data = {
            'id': '1234',
            'name': 'json-tester',
            'actions': [{'say-hello': 'hello world'}, {'say-goodbye': 'bye'}]
        }

        serializer = DummySerializer(data={'json_field': data})
        assert serializer.is_valid()
        assert serializer.object == {
            'json_field': {
                'id': '1234',
                'name': 'json-tester',
                'actions': [{'say-hello': 'hello world'}, {'say-goodbye': 'bye'}]
            }
        }

    def test_invalid_json(self):
        data = {'I\'m just a string'}
        serializer = DummySerializer(data={'json_field': data})
        assert serializer.is_valid() is False
        assert serializer.errors == {'json_field': [u'Value must be valid JSON.']}
        assert serializer.object is None
