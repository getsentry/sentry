from __future__ import absolute_import

from django.contrib.contenttypes.models import ContentType
from django.test import TestCase

from sentry.api.serializers.rest_framework.base import (
    CamelSnakeModelSerializer,
    convert_dict_key_case,
    camel_to_snake_case,
)


class ContentTypeSerializer(CamelSnakeModelSerializer):
    class Meta:
        model = ContentType
        fields = ["app_label", "model"]


class CamelSnakeModelSerializerTest(TestCase):
    def test_simple(self):
        serializer = ContentTypeSerializer(data={"appLabel": "hello", "model": "Something"})
        assert serializer.is_valid()
        assert serializer.data == {"model": u"Something", "app_label": u"hello"}

    def test_error(self):
        serializer = ContentTypeSerializer(data={"appLabel": None})
        assert not serializer.is_valid()
        assert serializer.errors == {
            "appLabel": [u"This field may not be null."],
            "model": [u"This field is required."],
        }


def test_convert_dict_key_case():
    data = {
        "appLabel": "hello",
        "model": "Something",
        "nestedList": [
            {"someObject": "someValue", "nestWithinNest": [{"anotherKey": "andAValue"}]}
        ],
    }
    converted_data = convert_dict_key_case(data, camel_to_snake_case)
    assert converted_data == {
        "app_label": "hello",
        "model": "Something",
        "nested_list": [
            {"some_object": "someValue", "nest_within_nest": [{"another_key": "andAValue"}]}
        ],
    }
