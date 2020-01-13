from __future__ import absolute_import

from django.contrib.contenttypes.models import ContentType
from django.test import TestCase
from rest_framework import serializers

from sentry.api.serializers.rest_framework.base import (
    CamelSnakeSerializer,
    CamelSnakeModelSerializer,
)


class PersonSerializer(CamelSnakeSerializer):
    name = serializers.CharField()
    works_at = serializers.CharField()


class CamelSnakeSerializerTest(TestCase):
    def test_simple(self):
        serializer = PersonSerializer(data={"name": "Rick", "worksAt": "Sentry"})
        assert serializer.is_valid()
        assert serializer.data == {"name": u"Rick", "works_at": u"Sentry"}

    def test_error(self):
        serializer = PersonSerializer(data={"worksAt": None})
        assert not serializer.is_valid()
        assert serializer.errors == {
            "worksAt": [u"This field may not be null."],
            "name": [u"This field is required."],
        }


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
