import pytest
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from sentry.api.fields.transformations import TransformationsField
from sentry.testutils.cases import TestCase


class TransformationsSerializer(serializers.Serializer):
    transformations = TransformationsField()


@pytest.mark.parametrize(
    "transformations",
    [
        {0: ["fill(locf)"]},
        {"01": ["fill(locf)"]},
        {"-1": ["fill(locf)"]},
        {"+1": ["fill(locf)"]},
        {"1.0": ["fill(locf)"]},
        {"٠": ["fill(locf)"]},
        pytest.param({"9" * 5000: []}, id="oversized-index"),
        {"0": "fill(locf)"},
        {"0": [1]},
        {"0": [None]},
        {"0": [True]},
        [],
        None,
    ],
)
def test_invalid_transformation_shape(transformations) -> None:
    with pytest.raises(ValidationError):
        TransformationsField().run_validation(transformations)


class TransformationsFieldTest(TestCase):
    def assert_rejected(self, transformations) -> None:
        field = TransformationsSerializer(context={"organization": self.organization}).fields[
            "transformations"
        ]
        with self.feature("organizations:explore-interpolation-and-smoothing"):
            with pytest.raises(ValidationError):
                field.run_validation(transformations)

    def test_rejects_null_character(self) -> None:
        self.assert_rejected({"0": ["fill(\x00)"]})

    def test_rejects_surrogate_character(self) -> None:
        self.assert_rejected({"0": ["\ud800"]})

    def test_rejects_low_surrogate_character(self) -> None:
        self.assert_rejected({"0": ["\udfff"]})

    def test_rejects_long_function(self) -> None:
        self.assert_rejected({"0": ["x" * 1025]})

    def test_rejects_many_functions(self) -> None:
        self.assert_rejected({"0": ["fill(locf)"] * 11})

    def test_rejects_many_axes(self) -> None:
        self.assert_rejected({str(index): [] for index in range(101)})

    def test_rejects_long_index_key(self) -> None:
        self.assert_rejected({"9" * 11: []})

    def test_preserves_opaque_strings_at_size_limits(self) -> None:
        transformations = {str(index): ["x" * 1024] * 10 for index in range(100)}
        field = TransformationsSerializer(context={"organization": self.organization}).fields[
            "transformations"
        ]
        with self.feature("organizations:explore-interpolation-and-smoothing"):
            result = field.run_validation(transformations)
        assert result == transformations

    def test_preserves_metadata_without_feature(self) -> None:
        transformations = {"0": [" future(function) ", "fill(locf)", "fill(locf)", ""], "1": []}
        field = TransformationsSerializer(context={"organization": self.organization}).fields[
            "transformations"
        ]
        with self.feature({"organizations:explore-interpolation-and-smoothing": False}):
            result = field.run_validation(transformations)
        assert result == transformations

    def test_preserves_unicode_and_literal_escape_without_context(self) -> None:
        transformations = {"0": ["🙂" * 1024, r"fill(\u0000)"]}
        assert TransformationsField().run_validation(transformations) == transformations
