from __future__ import annotations

import pytest

from sentry.investigations.services.parameters import (
    ParameterValidationError,
    validate_parameter_value,
    validate_template_parameters,
)
from sentry.investigations.templates.types import TemplateParameterSpec

REQUIRED = TemplateParameterSpec(key="env", label="Env", type="string", required=True)
OPTIONAL = TemplateParameterSpec(key="env", label="Env", type="string")


def test_required_parameter_rejects_an_omitted_key() -> None:
    with pytest.raises(ParameterValidationError):
        validate_template_parameters((REQUIRED,), {})


def test_required_parameter_rejects_an_explicit_null() -> None:
    with pytest.raises(ParameterValidationError):
        validate_template_parameters((REQUIRED,), {"env": None})


def test_required_parameter_accepts_a_value() -> None:
    assert validate_template_parameters((REQUIRED,), {"env": "prod"}) == {"env": "prod"}


def test_optional_parameter_still_accepts_an_explicit_null() -> None:
    assert validate_template_parameters((OPTIONAL,), {"env": None}) == {"env": None}


def test_unknown_parameters_are_rejected() -> None:
    with pytest.raises(ParameterValidationError):
        validate_template_parameters((OPTIONAL,), {"nope": "x"})


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_number_parameter_rejects_non_finite_values(value: float) -> None:
    """
    JSON parsing accepts these, but a JSONField cannot store them, and every
    comparison against them is False so min/max would not reject them either.
    """
    with pytest.raises(ParameterValidationError):
        validate_parameter_value(parameter_type="number", value=value, constraints={})


def test_number_parameter_accepts_finite_values() -> None:
    assert validate_parameter_value(parameter_type="number", value=1.5, constraints={}) == 1.5
