from __future__ import annotations

import pytest

from sentry.investigations.services.parameters import (
    ParameterValidationError,
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
