import pytest

from sentry.testutils.helpers.options import override_options
from sentry.utils.options import sample_modulo


@pytest.mark.parametrize(
    "option_value, org_id, expected_result",
    [
        (None, 123, False),
        ("bogus", 100, False),
        (123, 100, True),  # weird but valid
        (0.0, 100, False),
        (0.0, 199, False),
        (0.5, 3149, True),
        (0.5, 3150, False),
        (0.5, 3199, False),
        (0.5, 3200, True),
    ],
)
def test_sample_modulo(option_value, org_id, expected_result):
    option_name = "relay.transaction-metrics-org-sample-rate"
    with override_options({option_name: option_value}):
        assert sample_modulo(option_name, org_id) == expected_result
