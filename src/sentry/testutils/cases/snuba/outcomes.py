from __future__ import annotations

import pytest
import requests
from django.conf import settings

from sentry.utils import json

from ...skips import requires_snuba
from ..base import TestCase


@pytest.mark.snuba
@requires_snuba
class OutcomesSnubaTest(TestCase):
    def setUp(self):
        super().setUp()
        assert requests.post(settings.SENTRY_SNUBA + "/tests/outcomes/drop").status_code == 200

    def store_outcomes(self, outcome, num_times=1):
        outcomes = []
        for _ in range(num_times):
            outcome_copy = outcome.copy()
            outcome_copy["timestamp"] = outcome_copy["timestamp"].strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            outcomes.append(outcome_copy)

        assert (
            requests.post(
                settings.SENTRY_SNUBA + "/tests/outcomes/insert", data=json.dumps(outcomes)
            ).status_code
            == 200
        )
