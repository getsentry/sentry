from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys

from sentry.models import (
    Dashboard,
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.testutils import AcceptanceTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from tests.acceptance.page_objects.dashboard_detail import DashboardDetailPage

FEATURE_NAMES = [
    "organizations:discover-basic",
    "organizations:discover-query",
    "organizations:dashboards-basic",
]

EDIT_FEATURE = ["organizations:dashboards-edit"]

GRID_LAYOUT_FEATURE = ["organizations:dashboard-grid-layout"]

WIDGET_LIBRARY_FEATURE = ["organizations:widget-library"]


class OrganizationDashboardsAcceptanceTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"event_id": "a" * 32, "message": "oh no", "timestamp": min_ago},
            project_id=self.project.id,
        )
        self.page = DashboardDetailPage(self.browser, self.client, self.organization)
        self.login_as(self.user)

    def test_view_dashboard(self):
        with self.feature(FEATURE_NAMES):
            self.page.visit_default_overview()
            self.browser.snapshot("dashboards - default overview")

    def test_view_dashboard_with_manager(self):
        with self.feature(FEATURE_NAMES + EDIT_FEATURE):
            self.page.visit_default_overview()
            self.browser.snapshot("dashboards - default overview manager")

    def test_edit_dashboard(self):
        with self.feature(FEATURE_NAMES + EDIT_FEATURE):
            self.page.visit_default_overview()
            self.page.enter_edit_state()
            self.browser.snapshot("dashboards - edit state")

    def test_add_widget(self):
        with self.feature(FEATURE_NAMES + EDIT_FEATURE):
            self.page.visit_default_overview()
            self.page.enter_edit_state()

            # Add a widget
            self.page.click_dashboard_add_widget_button()
            self.browser.snapshot("dashboards - add widget")

    def test_edit_widget(self):
        with self.feature(FEATURE_NAMES + EDIT_FEATURE):
            self.page.visit_default_overview()
            self.page.enter_edit_state()

            # Edit the first widget.
            button = self.browser.element('[data-test-id="widget-edit"]')
            button.click()
            self.browser.snapshot("dashboards - edit widget")

    def test_widget_library(self):
        with self.feature(FEATURE_NAMES + EDIT_FEATURE + WIDGET_LIBRARY_FEATURE):
            self.page.visit_default_overview()

            # Open widget library
            self.page.click_dashboard_header_add_widget_button()

            self.browser.element('[data-test-id="library-tab"]').click()

            # Select/deselect widget library cards
            self.browser.element('[data-test-id="widget-library-card-0"]').click()
            self.browser.element('[data-test-id="widget-library-card-2"]').click()
            self.browser.element('[data-test-id="widget-library-card-3"]').click()
            self.browser.element('[data-test-id="widget-library-card-2"]').click()

            self.browser.snapshot("dashboards - widget library")


class OrganizationDashboardLayoutAcceptanceTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.team = self.create_team(organization=self.organization, name="Mariachi Band")
        self.project = self.create_project(
            organization=self.organization, teams=[self.team], name="Bengal"
        )
        self.dashboard = Dashboard.objects.create(
            title="Dashboard 1", created_by=self.user, organization=self.organization
        )
        self.login_as(self.user)

        self.default_path = f"/organizations/{self.organization.slug}/dashboard/{self.dashboard.id}"

    def wait_until_loaded(self):
        self.browser.wait_until_not(".loading-indicator")
        self.browser.wait_until_not('[data-test-id="loading-placeholder"]')

    def test_create_new_dashboard_with_modified_widget_layout(self):
        with self.feature(FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE):
            # Create a new dashboard
            self.browser.get(f"/organizations/{self.organization.slug}/dashboards/new/")
            self.wait_until_loaded()

            # Add a widget
            button = self.browser.element('[data-test-id="widget-add"]')
            button.click()
            title_input = self.browser.element('input[data-test-id="widget-title-input"]')
            title_input.send_keys("New Widget")
            button = self.browser.element('[data-test-id="add-widget"]')
            button.click()

            dragHandle = self.browser.element(".widget-drag")
            # Drag to the right
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(dragHandle, 1000, 0).perform()

            # Save this dashboard
            button = self.browser.element('[data-test-id="dashboard-commit"]')
            button.click()

            self.browser.snapshot("dashboards - save widget layout in new custom dashboard")
            self.browser.refresh()
            self.wait_until_loaded()
            self.browser.snapshot(
                "dashboards - save widget layout in new custom dashboard (refresh)"
            )

    def test_add_and_move_new_widget_on_existing_dashboard(self):
        with self.feature(FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE):
            self.browser.get(self.default_path)
            self.wait_until_loaded()

            # Go to edit mode.
            button = self.browser.element('[data-test-id="dashboard-edit"]')
            button.click()

            # Add a widget
            button = self.browser.element('[data-test-id="widget-add"]')
            button.click()
            title_input = self.browser.element('input[data-test-id="widget-title-input"]')
            title_input.send_keys("New Widget")
            button = self.browser.element('[data-test-id="add-widget"]')
            button.click()

            dragHandle = self.browser.element(".widget-drag")
            # Drag to the right
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(dragHandle, 1000, 0).perform()

            button = self.browser.element('[data-test-id="dashboard-commit"]')
            button.click()

            self.browser.snapshot("dashboards - save new widget layout in custom dashboard")
            self.browser.refresh()
            self.wait_until_loaded()
            self.browser.snapshot(
                "dashboards - save new widget layout in custom dashboard (refresh)"
            )

    def test_move_existing_widget_on_existing_dashboard(self):
        existing_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="Existing Widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
        )
        DashboardWidgetQuery.objects.create(widget=existing_widget, fields=["count()"], order=0)
        with self.feature(FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE):
            self.browser.get(self.default_path)
            self.wait_until_loaded()

            # Go to edit mode.
            button = self.browser.element('[data-test-id="dashboard-edit"]')
            button.click()

            dragHandle = self.browser.element(".widget-drag")
            # Drag to the right
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(dragHandle, 1000, 0).perform()

            button = self.browser.element('[data-test-id="dashboard-commit"]')
            button.click()

            self.browser.snapshot("dashboards - save modified widget layout in custom dashboard")
            self.browser.refresh()
            self.wait_until_loaded()
            self.browser.snapshot(
                "dashboards - save modified widget layout in custom dashboard (refresh)"
            )

    def test_add_by_widget_library_do_not_overlap(self):
        with self.feature(
            FEATURE_NAMES + EDIT_FEATURE + WIDGET_LIBRARY_FEATURE + GRID_LAYOUT_FEATURE
        ):
            self.browser.get(self.default_path)
            self.wait_until_loaded()

            # Go to edit mode.
            button = self.browser.element('[data-test-id="add-widget-library"]')
            button.click()

            self.browser.element('[data-test-id="library-tab"]').click()

            # Add library widgets
            self.browser.element('[data-test-id="widget-library-card-0"]').click()
            self.browser.element('[data-test-id="widget-library-card-2"]').click()
            self.browser.element('[data-test-id="widget-library-card-3"]').click()
            self.browser.element('[data-test-id="widget-library-card-2"]').click()
            self.browser.element('[data-test-id="confirm-widgets"]').click()

            self.browser.snapshot(
                "dashboards - widgets from widget library do not overlap when added"
            )
            self.browser.refresh()
            self.wait_until_loaded()
            self.browser.snapshot(
                "dashboards - widgets from widget library do not overlap when added (refresh)"
            )

    def test_widget_edit_keeps_same_layout_after_modification(self):
        existing_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="Existing Widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
        )
        DashboardWidgetQuery.objects.create(widget=existing_widget, fields=["count()"], order=0)
        with self.feature(FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE):
            self.browser.get(self.default_path)
            self.wait_until_loaded()

            # Go to edit mode.
            button = self.browser.element('[data-test-id="dashboard-edit"]')
            button.click()

            # Edit the first widget
            button = self.browser.element('[data-test-id="widget-edit"]')
            button.click()
            title_input = self.browser.element('input[data-test-id="widget-title-input"]')
            title_input.send_keys(Keys.END, "UPDATED!!")
            button = self.browser.element('[data-test-id="add-widget"]')
            button.click()

            dragHandle = self.browser.element(".widget-drag")
            # Drag to the right
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(dragHandle, 1000, 0).perform()

            button = self.browser.element('[data-test-id="dashboard-commit"]')
            button.click()

            self.browser.snapshot("dashboards - save modified widget layout in custom dashboard")
            self.browser.refresh()
            self.wait_until_loaded()
            self.browser.snapshot(
                "dashboards - save modified widget layout in custom dashboard (refresh)"
            )


class OrganizationDashboardsManageAcceptanceTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.team = self.create_team(organization=self.organization, name="Mariachi Band")
        self.project = self.create_project(
            organization=self.organization, teams=[self.team], name="Bengal"
        )
        self.dashboard = Dashboard.objects.create(
            title="Dashboard 1", created_by=self.user, organization=self.organization
        )
        self.widget_1 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="Widget 1",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
        )
        self.widget_2 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=1,
            title="Widget 2",
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
        )
        self.login_as(self.user)

        self.default_path = f"/organizations/{self.organization.slug}/dashboards/"

    def wait_until_loaded(self):
        self.browser.wait_until_not(".loading-indicator")
        self.browser.wait_until_not('[data-test-id="loading-placeholder"]')

    def test_dashboard_manager(self):
        with self.feature(FEATURE_NAMES + EDIT_FEATURE):
            self.browser.get(self.default_path)
            self.wait_until_loaded()
            self.browser.snapshot("dashboards - manage overview")
