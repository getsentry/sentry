from collections.abc import Callable
from typing import Any

import pytest

from sentry.workflow_engine.endpoints.serializers import response_schemas


@pytest.mark.parametrize(
    "build",
    [
        response_schemas.condition_comparison_schema,
        response_schemas.action_config_schema,
        response_schemas.detector_config_schema,
        response_schemas.workflow_config_schema,
    ],
)
def test_builds_fully_described_schema(build: Callable[[], dict[str, Any]]) -> None:
    # Raises UndescribedPropertyError when a handler or detector type adds a property
    # that the descriptions in response_schemas don't cover.
    assert build()
