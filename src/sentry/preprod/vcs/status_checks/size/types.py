from __future__ import annotations

from dataclasses import dataclass


@dataclass
class StatusCheckRule:
    """A rule that defines when a status check should fail.

    Measurement types:
    - absolute: Fail if size exceeds threshold in bytes
    - absolute_diff: Fail if size increases by more than threshold in bytes
    - relative_diff: Fail if size increases by more than percentage

    Examples:
        StatusCheckRule(
            id="rule-1",
            metric="install_size",
            measurement="absolute",
            value=52428800,
            filter_query="platform:iOS"
        )
        Triggers failure if any iOS build exceeds 50MB (52428800 bytes).

        StatusCheckRule(
            id="rule-2",
            metric="install_size",
            measurement="absolute_diff",
            value=5242880,
            filter_query="platform:iOS"
        )
        Triggers failure if any iOS build increases by more than 5MB (5242880 bytes).

        StatusCheckRule(
            id="rule-3",
            metric="download_size",
            measurement="relative_diff",
            value=10.0,
            filter_query=""
        )
        Triggers failure if any build's download size increases by more than 10%.
    """

    id: str
    metric: str
    measurement: str
    value: float
    filter_query: str = ""
