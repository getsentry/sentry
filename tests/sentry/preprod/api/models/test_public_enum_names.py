from enum import Enum
from typing import Any, get_args

import pytest

from sentry.preprod.api.models.public.installable_builds import BuildState
from sentry.preprod.api.models.public.shared import ArtifactTypeName
from sentry.preprod.api.models.public.size_analysis import (
    ComparisonStateName,
    MetricsArtifactTypeName,
    SizeAnalysisStateName,
)
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)


@pytest.mark.parametrize(
    ("literal", "enum"),
    [
        (BuildState, PreprodArtifact.ArtifactState),
        (ArtifactTypeName, PreprodArtifact.ArtifactType),
        (MetricsArtifactTypeName, PreprodArtifactSizeMetrics.MetricsArtifactType),
        (ComparisonStateName, PreprodArtifactSizeComparison.State),
        (SizeAnalysisStateName, PreprodArtifactSizeMetrics.SizeAnalysisState),
    ],
)
def test_literal_matches_enum_names(literal: Any, enum: type[Enum]) -> None:
    assert set(get_args(literal)) == set(enum.__members__)
