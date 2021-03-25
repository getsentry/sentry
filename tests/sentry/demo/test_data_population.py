from django.test import override_settings

from sentry.demo.settings import DEMO_DATA_GEN_PARAMS
from sentry.demo.data_population import handle_react_python_scenario
from sentry.models import (
    Release,
)
from sentry.testutils import TestCase


# significantly decrease event volume
DEMO_DATA_GEN_PARAMS = DEMO_DATA_GEN_PARAMS.copy()
DEMO_DATA_GEN_PARAMS["MAX_DAYS"] = 1
DEMO_DATA_GEN_PARAMS["SCALE_FACTOR"] = 0.1


@override_settings(DEMO_MODE=True, DEMO_DATA_GEN_PARAMS=DEMO_DATA_GEN_PARAMS)
class DataPopulationTest(TestCase):
    def setUp(self):
        super().setUp()
        self.react_project = self.create_project(organization=self.organization, platform="react")
        self.python_project = self.create_project(organization=self.organization, platform="python")

    def test_basic(self):
        # let's just make sure things don't blow up
        handle_react_python_scenario(self.react_project, self.python_project)
        assert Release.objects.filter(organization=self.organization).count() == 3
