import pytz

from urllib.parse import urlencode
from sentry.utils.compat.mock import patch

from django.db.models import F
from sentry.models import Project
from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data

from .page_objects.base import BasePage

FEATURE_NAMES = (
    "organizations:performance-view",
    "organizations:performance-vitals-overview",
)


class PerformanceVitalDetailsTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band", members=[self.user]
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.group = self.create_group(project=self.project)
        self.login_as(self.user)
        self.path = "/organizations/{}/performance/vitaldetail/?{}".format(
            self.org.slug,
            urlencode({"query": "transaction.duration:>0"}),
        )

        self.page = BasePage(self.browser)

    @patch("django.utils.timezone.now")
    def test_with_data(self, mock_now):

        mock_now.return_value = before_now().replace(tzinfo=pytz.utc)

        event = load_data("transaction", timestamp=before_now(minutes=1))
        self.store_event(data=event, project_id=self.project.id)
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))

        with self.feature(FEATURE_NAMES):
            self.browser.get(self.path)
            self.page.wait_until_loaded()

            self.browser.wait_until_not(
                '[data-test-id="grid-editable"] [data-test-id="empty-state"]', timeout=2
            )
            self.browser.snapshot("performance vital detail - with data")
