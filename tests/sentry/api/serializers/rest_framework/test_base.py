from __future__ import absolute_import

from rest_framework import serializers

from django.contrib.contenttypes.models import ContentType
from django.test import TestCase

from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer


class ContentTypeSerializer(CamelSnakeModelSerializer):
    nested_list = serializers.ListField()

    class Meta:
        model = ContentType
        fields = ["app_label", "model", "nested_list"]


class CamelSnakeModelSerializerTest(TestCase):
    def test_simple(self):
        serializer = ContentTypeSerializer(data={"appLabel": "hello", "model": "Something"})
        assert serializer.is_valid()
        assert serializer.data == {"model": u"Something", "app_label": u"hello"}

    def test_nested(self):
        serializer = ContentTypeSerializer(
            data={
                "appLabel": "hello",
                "model": "Something",
                "nestedList": [
                    {"someObject": "someValue", "nestWithinNest": [{"anotherKey": "andAValue"}]}
                ],
            }
        )
        assert serializer.is_valid()
        print ("data:", serializer.data)
        assert serializer.data == {
            "app_label": "hello",
            "model": "Something",
            "nested_list": [
                {"some_object": "someValue", "nest_within_nest": [{"another_key": "andAValue"}]}
            ],
        }

    def test_error(self):
        serializer = ContentTypeSerializer(data={"appLabel": None})
        assert not serializer.is_valid()
        assert serializer.errors == {
            "appLabel": [u"This field may not be null."],
            "model": [u"This field is required."],
        }
