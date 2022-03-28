import pytest

from ....helpers import apply_feature_flag_on_cls
from ...api import APITestCase
from .base import SessionMetricsTestCase


@apply_feature_flag_on_cls("organizations:metrics")
@pytest.mark.usefixtures("reset_snuba")
class MetricsAPIBaseTestCase(SessionMetricsTestCase, APITestCase):
    pass
