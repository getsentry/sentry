from django.test import override_settings

from sentry.demo.data_population import DataPopulation
from sentry.demo.settings import DEMO_DATA_GEN_PARAMS, DEMO_DATA_QUICK_GEN_PARAMS
from sentry.testutils import TestCase

# significantly decrease event volume
DEMO_DATA_GEN_PARAMS = DEMO_DATA_GEN_PARAMS.copy()
DEMO_DATA_GEN_PARAMS["MAX_DAYS"] = 1
DEMO_DATA_GEN_PARAMS["SCALE_FACTOR"] = 0.05

DEMO_DATA_QUICK_GEN_PARAMS = DEMO_DATA_QUICK_GEN_PARAMS.copy()
DEMO_DATA_QUICK_GEN_PARAMS["SCALE_FACTOR"] = 0.20


@override_settings(
    DEMO_MODE=True,
    DEMO_DATA_GEN_PARAMS=DEMO_DATA_GEN_PARAMS,
    DEMO_DATA_QUICK_GEN_PARAMS=DEMO_DATA_QUICK_GEN_PARAMS,
)
class DataPopulationTest(TestCase):
    def setUp(self):
        super().setUp()

    def test_get_config_var(self):

        data_population = DataPopulation(self.organization, True)

        assert (
            data_population.get_config_var("SCALE_FACTOR")
            == DEMO_DATA_QUICK_GEN_PARAMS["SCALE_FACTOR"]
        )
        assert "BASE_OFFSET" not in DEMO_DATA_QUICK_GEN_PARAMS
        assert data_population.get_config_var("BASE_OFFSET") == DEMO_DATA_GEN_PARAMS["BASE_OFFSET"]
