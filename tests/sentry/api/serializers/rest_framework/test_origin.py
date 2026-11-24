from typing import TypedDict

from rest_framework import serializers

from sentry.api.serializers.rest_framework import OriginField
from sentry.testutils.cases import TestCase


class OriginSerializerData(TypedDict):
    origin_field: str


class DummySerializer(serializers.Serializer[object, OriginSerializerData]):
    origin_field = OriginField()


class OriginFieldTest(TestCase):
    def test_valid_origin(self) -> None:
        urls = ["https://www.foo.com", "*", "*.domain.com", "*:80", "localhost:8080"]
        for url in urls:
            serializer = DummySerializer(data={"origin_field": url})
            assert serializer.is_valid()

    def test_invalid_origin(self) -> None:
        urls = ["https://www.foo.com:*", "localhost:*"]
        for url in urls:
            serializer = DummySerializer(data={"origin_field": url})
            assert serializer.is_valid() is False
