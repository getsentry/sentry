from __future__ import annotations

from unittest import mock

import pytest
from django.db import IntegrityError

from sentry.investigations.services.investigations import create_template_investigation

TEMPLATE_KWARGS = {
    "organization": mock.sentinel.organization,
    "user_id": 1,
    "template_key": "breached_metric",
    "template_version": 1,
    "source_ref": {},
    "supplied_parameters": {},
    "accessible_project_ids": set(),
}


def test_template_creation_retries_revision_uniqueness_collisions() -> None:
    created = mock.sentinel.investigation
    with mock.patch(
        "sentry.investigations.services.investigations._create_template_investigation",
        side_effect=[IntegrityError(), created],
    ) as create:
        result = create_template_investigation(**TEMPLATE_KWARGS)

    assert result is created
    assert create.call_count == 2


def test_template_creation_succeeds_without_a_collision() -> None:
    created = mock.sentinel.investigation
    with mock.patch(
        "sentry.investigations.services.investigations._create_template_investigation",
        return_value=created,
    ) as create:
        result = create_template_investigation(**TEMPLATE_KWARGS)

    assert result is created
    assert create.call_count == 1


def test_template_creation_reraises_after_exhausting_retries() -> None:
    with mock.patch(
        "sentry.investigations.services.investigations._create_template_investigation",
        side_effect=IntegrityError(),
    ) as create:
        with pytest.raises(IntegrityError):
            create_template_investigation(**TEMPLATE_KWARGS)

    assert create.call_count == 3
