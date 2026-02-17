from rest_framework import serializers

from sentry.api.serializers.rest_framework import OriginField


class DummySerializer(serializers.Serializer):
    origin_field = OriginField()


def test_origin_field_valid_origin() -> None:
    urls = ["https://www.foo.com", "*", "*.domain.com", "*:80", "localhost:8080"]
    for url in urls:
        serializer = DummySerializer(data={"origin_field": url})
        assert serializer.is_valid()


def test_origin_field_invalid_origin() -> None:
    urls = ["https://www.foo.com:*", "localhost:*"]
    for url in urls:
        serializer = DummySerializer(data={"origin_field": url})
        assert serializer.is_valid() is False
