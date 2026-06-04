from unittest.mock import MagicMock, patch

import pytest
from django.contrib.contenttypes.models import ContentType
from rest_framework import serializers

from sentry.api.serializers.rest_framework.base import (
    CamelSnakeModelSerializer,
    CamelSnakeSerializer,
    _classify_key_case,
    camel_to_snake_case,
    convert_dict_key_case,
    snake_to_camel_case,
)
from sentry.testutils.cases import TestCase


class PersonSerializer(CamelSnakeSerializer):
    name = serializers.CharField()
    works_at = serializers.CharField()


class CamelSnakeSerializerTest(TestCase):
    def test_simple(self) -> None:
        serializer = PersonSerializer(data={"name": "Rick", "worksAt": "Sentry"})
        assert serializer.is_valid()
        assert serializer.data == {"name": "Rick", "works_at": "Sentry"}

    def test_error(self) -> None:
        serializer = PersonSerializer(data={"worksAt": None})
        assert not serializer.is_valid()
        assert serializer.errors == {
            "worksAt": ["This field may not be null."],
            "name": ["This field is required."],
        }

    def test_smuggling(self) -> None:
        with pytest.raises(
            serializers.ValidationError,
            match=r"_name collides with name, please pass only one value",
        ):
            PersonSerializer(data={"name": "Rick", "worksAt": "Sentry", "_name": "Chuck"})


class ContentTypeSerializer(CamelSnakeModelSerializer):
    class Meta:
        model = ContentType
        fields = ["app_label", "model"]


class CamelSnakeModelSerializerTest(TestCase):
    def test_simple(self) -> None:
        serializer = ContentTypeSerializer(data={"appLabel": "hello", "model": "Something"})
        assert serializer.is_valid()
        assert serializer.data == {"model": "Something", "app_label": "hello"}

    def test_error(self) -> None:
        serializer = ContentTypeSerializer(data={"appLabel": None})
        assert not serializer.is_valid()
        assert serializer.errors == {
            "appLabel": ["This field may not be null."],
            "model": ["This field is required."],
        }


def test_convert_dict_key_case() -> None:
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

    assert camelData == convert_dict_key_case(snake_data, snake_to_camel_case)


class ClassifyKeyCaseTest(TestCase):
    def test_camel_keys(self) -> None:
        assert _classify_key_case({"firstName": "a", "lastName": "b"}) == "camel"

    def test_snake_keys(self) -> None:
        assert _classify_key_case({"first_name": "a", "last_name": "b"}) == "snake"

    def test_mixed_keys(self) -> None:
        assert _classify_key_case({"firstName": "a", "last_name": "b"}) == "mixed"

    def test_single_word_keys_only(self) -> None:
        assert _classify_key_case({"name": "a", "id": "b"}) == "uncertain"

    def test_empty_dict(self) -> None:
        assert _classify_key_case({}) == "uncertain"

    def test_camel_with_single_word(self) -> None:
        assert _classify_key_case({"firstName": "a", "name": "b"}) == "camel"

    def test_snake_with_single_word(self) -> None:
        assert _classify_key_case({"first_name": "a", "name": "b"}) == "snake"


class RecordKeyCaseMetricTest(TestCase):
    @patch("sentry.api.serializers.rest_framework.base.metrics")
    def test_camel_case_emits_metric(self, mock_metrics: MagicMock) -> None:
        PersonSerializer(data={"worksAt": "Sentry", "name": "Rick"})
        mock_metrics.incr.assert_called_once_with(
            "api.serializer.parameter_key_case",
            tags={
                "key_case": "camel",
                "serializer": "PersonSerializer",
            },
        )

    @patch("sentry.api.serializers.rest_framework.base.metrics")
    def test_snake_case_emits_metric(self, mock_metrics: MagicMock) -> None:
        PersonSerializer(data={"works_at": "Sentry", "name": "Rick"})
        mock_metrics.incr.assert_called_once_with(
            "api.serializer.parameter_key_case",
            tags={
                "key_case": "snake",
                "serializer": "PersonSerializer",
            },
        )

    @patch("sentry.api.serializers.rest_framework.base.metrics")
    def test_uncertain_data_emits_metric(self, mock_metrics: MagicMock) -> None:
        PersonSerializer(data={"name": "Rick"})
        mock_metrics.incr.assert_called_once_with(
            "api.serializer.parameter_key_case",
            tags={
                "key_case": "uncertain",
                "serializer": "PersonSerializer",
            },
        )

    @patch("sentry.api.serializers.rest_framework.base.metrics")
    def test_list_data_skips_metric(self, mock_metrics: MagicMock) -> None:
        PersonSerializer(data=[{"worksAt": "Sentry"}])
        mock_metrics.incr.assert_not_called()

    @patch("sentry.api.serializers.rest_framework.base.metrics")
    def test_model_serializer_emits_metric(self, mock_metrics: MagicMock) -> None:
        ContentTypeSerializer(data={"appLabel": "hello", "model": "Something"})
        mock_metrics.incr.assert_called_once()
        tags = mock_metrics.incr.call_args[1]["tags"]
        assert tags["key_case"] == "camel"
        assert tags["serializer"] == "ContentTypeSerializer"
