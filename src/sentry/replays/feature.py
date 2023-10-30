from __future__ import annotations


def has_feature_access(organization_id: int, sample_rate: int, allow_list: list[int]) -> bool:
    """Return "True" if the organization has access to the feature."""
    return (organization_id in allow_list) or (organization_id % 100 < sample_rate)
