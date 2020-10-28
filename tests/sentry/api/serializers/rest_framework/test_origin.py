from __future__ import absolute_import
from sentry.api.serializers.rest_framework import OriginField

from rest_framework import serializers

from sentry.testutils import TestCase


class DummySerializer(serializers.Serializer):
    origin_field = OriginField()


class OriginFieldTest(TestCase):
    def test_valid_origin(self):
        urls = ["https://www.foo.com", "*"]

        for url in urls:
            serializer = DummySerializer(data={"origin_field": url})
            assert serializer.is_valid()

    def test_invalid_origin(self):
        url = "https://www.foo.com:88"
        serializer = DummySerializer(data={"origin_field": url})

        assert serializer.is_valid() is False
