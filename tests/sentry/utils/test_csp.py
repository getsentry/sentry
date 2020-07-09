from __future__ import absolute_import

import pytest

from sentry.interfaces.base import InterfaceValidationError
from sentry.interfaces.security import Csp


@pytest.mark.parametrize(
    "report",
    (
        {},
        {"effective_directive": "lolnotreal"},
        {"violated_directive": "lolnotreal"},
        {"violated_directive": " "},
    ),
)
def test_invalid_csp_report(report):
    with pytest.raises(InterfaceValidationError):
        Csp.to_python(report)
