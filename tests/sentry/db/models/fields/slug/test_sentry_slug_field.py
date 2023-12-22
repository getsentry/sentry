import pytest
from django.core.exceptions import ValidationError

from sentry.db.models.fields.slug import NoNumericValidator, SentrySlugField
from sentry.testutils.cases import TestCase


class TestDefaultValidators(TestCase):
    def setUp(self) -> None:
        self.field = SentrySlugField()

    def test_no_numeric_validator_added(self):
        validators = [validator.__class__ for validator in self.field.validators]

        # Ensure that NoNumericValidator is in the validators list
        self.assertIn(NoNumericValidator, validators)


class TestRunValidators(TestCase):
    def setUp(self) -> None:
        self.field = SentrySlugField()

    def test_valid_value(self):
        # Valid slug value should not raise a ValidationError
        self.field.run_validators("valid-slug")

    def test_numeric_value(self):
        # Numeric value should raise a ValidationError
        with pytest.raises(ValidationError):
            self.field.run_validators("123")
