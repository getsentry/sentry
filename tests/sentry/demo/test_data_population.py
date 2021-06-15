from django.test import override_settings

from sentry.demo.data_population import (
    DataPopulation,
    handle_mobile_scenario,
    handle_react_python_scenario,
)
from sentry.demo.settings import DEMO_DATA_GEN_PARAMS
from sentry.models import Project, Release
from sentry.testutils import TestCase
from sentry.utils.compat.mock import patch

# significantly decrease event volume
DEMO_DATA_GEN_PARAMS = DEMO_DATA_GEN_PARAMS.copy()
DEMO_DATA_GEN_PARAMS["MAX_DAYS"] = 1
DEMO_DATA_GEN_PARAMS["SCALE_FACTOR"] = 0.05


@override_settings(DEMO_MODE=True, DEMO_DATA_GEN_PARAMS=DEMO_DATA_GEN_PARAMS)
class DataPopulationTest(TestCase):
    def setUp(self):
        super().setUp()
        self.react_project = self.create_project(organization=self.organization, platform="react")
        self.python_project = self.create_project(organization=self.organization, platform="python")
        self.ios_project = self.create_project(organization=self.organization, platform="apple-ios")
        self.android_project = self.create_project(
            organization=self.organization, platform="android"
        )
        self.create_member(organization=self.organization, user=self.create_user())

    @patch.object(DataPopulation, "send_session")
    def test_basic(self, mock_send_session):
        # let's just make sure things don't blow up
        handle_react_python_scenario(self.react_project, self.python_project)
        handle_mobile_scenario(self.ios_project, self.android_project)
        assert Release.objects.filter(organization=self.organization).count() == 3
        assert len(Project.objects.filter(organization=self.organization)) == 4
