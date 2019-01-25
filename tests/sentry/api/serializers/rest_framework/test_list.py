from __future__ import absolute_import
from sentry.api.serializers.rest_framework import ListField

from rest_framework import serializers

from sentry.testutils import TestCase


class ListFieldTest(TestCase):
    def assert_success(self, serializer, value):
        assert serializer.is_valid()
        assert not serializer.errors
        assert serializer.object == value

    def assert_unsuccessful(self, serializer, errors):
        assert not serializer.is_valid()
        assert serializer.errors == errors
        assert serializer.object is None

    def test_simple(self):
        class DummySerializer(serializers.Serializer):
            list_field = ListField(child=serializers.IntegerField())
        serializer = DummySerializer(data={'list_field': [1, 2, 3]})
        self.assert_success(serializer, {'list_field': [1, 2, 3]})

    def test_single_element_list(self):
        class DummySerializer(serializers.Serializer):
            list_field = ListField(child=serializers.IntegerField())
        serializer = DummySerializer(data={'list_field': [1]})
        self.assert_success(serializer, {'list_field': [1]})

    def test_empty_list_child_required(self):
        class DummySerializer(serializers.Serializer):
            list_field = ListField(required=False, child=serializers.IntegerField())
        serializer = DummySerializer(data={'list_field': []})
        self.assert_success(serializer, {'list_field': []})

    def test_empty_list_child_required_default_value(self):
        class DummySerializer(serializers.Serializer):
            list_field = ListField(default=[], required=False, child=serializers.IntegerField())
        serializer = DummySerializer(data={'list_field': []})
        self.assert_success(serializer, {'list_field': []})

    def test_empty_list_child_required_complex_object(self):
        class DummyChildSerializer(serializers.Serializer):
            name = serializers.CharField()
            age = serializers.IntegerField()

        class DummySerializer(serializers.Serializer):
            list_field = ListField(required=False, child=DummyChildSerializer())
        serializer = DummySerializer(data={'list_field': []})
        self.assert_success(serializer, {'list_field': []})

    def test_empty_list_child_not_required_complex_object(self):
        class DummyChildSerializer(serializers.Serializer):
            name = serializers.CharField()
            age = serializers.IntegerField()

        class DummySerializer(serializers.Serializer):
            list_field = ListField(required=False, child=DummyChildSerializer(required=False))
        serializer = DummySerializer(data={'list_field': []})
        self.assert_success(serializer, {'list_field': []})

    def test_empty_list_child_not_required_complex_object_with_default(self):
        class DummyChildSerializer(serializers.Serializer):
            name = serializers.CharField()
            age = serializers.IntegerField()

        class DummySerializer(serializers.Serializer):
            list_field = ListField(
                default=[],
                required=False,
                child=DummyChildSerializer(
                    required=False))
        serializer = DummySerializer(data={'list_field': []})
        self.assert_success(serializer, {'list_field': []})

    def test_empty_list(self):
        class DummySerializer(serializers.Serializer):
            list_field = ListField(required=False, child=serializers.IntegerField(required=False))
        serializer = DummySerializer(data={'list_field': []})
        self.assert_success(serializer, {'list_field': []})

    def test_checks_required(self):
        class DummySerializer(serializers.Serializer):
            list_field = ListField(child=serializers.IntegerField())
        serializer = DummySerializer(data={})
        self.assert_unsuccessful(serializer, {'list_field': [u'This field is required.']})

    def test_allows_no_object_with_not_required(self):
        class DummySerializer(serializers.Serializer):
            list_field = ListField(child=serializers.IntegerField(), required=False)
        serializer = DummySerializer(data={})
        self.assert_success(serializer, {})

    def test_allows_object_with_not_required(self):
        class DummySerializer(serializers.Serializer):
            list_field = ListField(child=serializers.IntegerField(), required=False)
        serializer = DummySerializer(data={'list_field': [1, 2, 3]})
        self.assert_success(serializer, {'list_field': [1, 2, 3]})
