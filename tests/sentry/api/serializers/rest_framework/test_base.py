from __future__ import absolute_import

from django.test import TestCase
from django.db import models

from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer


class SampleModel(models.Model):
    camel_case = models.IntegerField()

    class Meta:
        app_label = 'sentry'


class SampleSerializer(CamelSnakeModelSerializer):
    class Meta:
        model = SampleModel
        fields = ['camel_case']


class CamelSnakeModelSerializerTest(TestCase):
    def test_simple(self):
        serializer = SampleSerializer(data={'camelCase': 1})
        assert serializer.is_valid()
        assert serializer.data == {'camel_case': 1}

    def test_error(self):
        serializer = SampleSerializer(data={'camelCase': 'hi'})
        assert not serializer.is_valid()
        assert serializer.errors == {'camelCase': ['A valid integer is required.']}
