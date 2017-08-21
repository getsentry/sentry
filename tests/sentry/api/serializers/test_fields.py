from __future__ import absolute_import

from rest_framework import serializers

from sentry.api.serializers.rest_framework import ListField
from sentry.testutils import TestCase


class ChildSerializer(serializers.Serializer):
    b_field = serializers.CharField(max_length=64)
    d_field = serializers.CharField(max_length=64)


class DummySerializer(serializers.Serializer):
    a_field = ListField(
        child=ChildSerializer(),
        required=False,
        allow_null=False,
    )


class TestListField(TestCase):
    def test_simple(self):
        data = {
            'a_field': [{
                'b_field': 'abcdefg',
                'd_field': 'gfedcba',
            }],
        }

        serializer = DummySerializer(data=data)
        assert serializer.is_valid()
        assert serializer.object == {
            'a_field': [{
                'b_field': 'abcdefg',
                'd_field': 'gfedcba',
            }],
        }

    def test_allow_null(self):
        data = {
            'a_field': [None],
        }

        serializer = DummySerializer(data=data)
        assert not serializer.is_valid()
        assert serializer.errors == {
            'a_field': ['non_field_errors: No input provided'],
        }

    def test_child_validates(self):
        data = {
            'a_field': [{
                'b_field': 'abcdefg'
            }],
        }

        serializer = DummySerializer(data=data)
        assert not serializer.is_valid()
        assert serializer.errors == {'a_field': [u'd_field: This field is required.']}
