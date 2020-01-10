from __future__ import absolute_import

from django.contrib.contenttypes.models import ContentType
from django.test import TestCase

from sentry.api.serializers.rest_framework.base import (
    CamelSnakeModelSerializer,
    convert_dict_key_case,
    camel_to_snake_case,
    snake_to_camel_case,
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
    camelData = {
        "appLabel": "hello",
        "model": "Something",
        "nestedList": [
            {"someObject": "someValue", "nestWithinNest": [{"anotherKey": "andAValue"}]}
        ],
    }
    snake_data = convert_dict_key_case(camelData, camel_to_snake_case)
    assert snake_data == {
        "app_label": "hello",
        "model": "Something",
        "nested_list": [
            {"some_object": "someValue", "nest_within_nest": [{"another_key": "andAValue"}]}
        ],
    }

    camelData2 = convert_dict_key_case(snake_data, snake_to_camel_case)
    assert camelData2 == camelData
