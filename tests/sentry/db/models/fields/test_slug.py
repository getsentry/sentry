import pytest
from django.core.exceptions import ValidationError

from sentry.db.models.fields.slug import SentrySlugField, no_numeric_validator
from sentry.testutils.cases import TestCase


class TestNoNumericValidator(TestCase):
    def test_non_numeric_value(self) -> None:
        no_numeric_validator("abc")

    def test_numeric_value(self) -> None:
        with pytest.raises(ValidationError):
            no_numeric_validator("123")

    def test_combination_of_numeric_and_non_numeric_values(self) -> None:
        no_numeric_validator("49dk20sk5")

    def test_emtpy_value(self) -> None:
        no_numeric_validator("")


class TestSentrySlugField(TestCase):
    def setUp(self) -> None:
        self.field = SentrySlugField()

    def test_valid_value(self) -> None:
        # Valid slug value should not raise a ValidationError
        self.field.run_validators("valid-slug")

    def test_numeric_value(self) -> None:
        # Numeric value should raise a ValidationError
        with pytest.raises(ValidationError):
            self.field.run_validators("123")
