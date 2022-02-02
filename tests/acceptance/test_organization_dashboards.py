from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

from sentry.models import (
    Dashboard,
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.testutils import AcceptanceTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from tests.acceptance.page_objects.dashboard_detail import (
    EDIT_WIDGET_BUTTON,
    WIDGET_DRAG_HANDLE,
    WIDGET_RESIZE_HANDLE,
    WIDGET_TITLE_FIELD,
    DashboardDetailPage,
)

FEATURE_NAMES = [
    "organizations:discover-basic",
    "organizations:discover-query",
    "organizations:dashboards-basic",
]

EDIT_FEATURE = ["organizations:dashboards-edit"]

GRID_LAYOUT_FEATURE = ["organizations:dashboard-grid-layout"]

ISSUE_WIDGET_FEATURE = ["organizations:issues-in-dashboards"]

WIDGET_LIBRARY_FEATURE = ["organizations:widget-library"]


class OrganizationDashboardsAcceptanceTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"event_id": "a" * 32, "message": "oh no", "timestamp": min_ago},
            project_id=self.project.id,
        )
        self.dashboard = Dashboard.objects.create(
            title="Dashboard 1", created_by=self.user, organization=self.organization
        )
        self.existing_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="Existing Widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
        )
        DashboardWidgetQuery.objects.create(
            widget=self.existing_widget, fields=["count()"], order=0
        )
        self.page = DashboardDetailPage(
            self.browser, self.client, organization=self.organization, dashboard=self.dashboard
        )
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
            button = self.browser.element(EDIT_WIDGET_BUTTON)
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

    def test_duplicate_widget_in_view_mode(self):
        with self.feature(FEATURE_NAMES + EDIT_FEATURE):
            self.page.visit_dashboard_detail()

            self.browser.element('[data-test-id="context-menu"]').click()
            self.browser.element('[data-test-id="duplicate-widget"]').click()
            self.page.wait_until_loaded()

            self.browser.elements('[data-test-id="context-menu"]')[0].click()
            self.browser.element('[data-test-id="duplicate-widget"]').click()
            self.page.wait_until_loaded()

            self.browser.snapshot("dashboard widget - duplicate")

    def test_delete_widget_in_view_mode(self):
        with self.feature(FEATURE_NAMES + EDIT_FEATURE):
            self.page.visit_dashboard_detail()

            self.browser.element('[data-test-id="context-menu"]').click()
            self.browser.element('[data-test-id="delete-widget"]').click()
            self.browser.element('[data-test-id="confirm-button"]').click()

            self.page.wait_until_loaded()

            self.browser.snapshot("dashboard widget - delete")


class OrganizationDashboardLayoutAcceptanceTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"event_id": "a" * 32, "message": "oh no", "timestamp": min_ago},
            project_id=self.project.id,
        )
        self.dashboard = Dashboard.objects.create(
            title="Dashboard 1", created_by=self.user, organization=self.organization
        )
        self.page = DashboardDetailPage(
            self.browser, self.client, organization=self.organization, dashboard=self.dashboard
        )
        self.login_as(self.user)

    def capture_screenshots(self, screenshot_name):
        """
        Captures screenshots in both a pre and post refresh state.

        Necessary for verifying that the layout persists after saving.
        """
        self.page.wait_until_loaded()
        self.browser.snapshot(screenshot_name)
        self.browser.refresh()
        self.page.wait_until_loaded()
        self.browser.snapshot(f"{screenshot_name} (refresh)")

    def test_add_and_move_new_widget_on_existing_dashboard(self):
        with self.feature(FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE):
            self.page.visit_dashboard_detail()
            self.page.enter_edit_state()

            self.page.add_widget_through_dashboard("New Widget")

            # Drag to the right
            dragHandle = self.browser.element(WIDGET_DRAG_HANDLE)
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(dragHandle, 1000, 0).perform()

            self.page.save_dashboard()

            self.capture_screenshots("dashboards - save new widget layout in custom dashboard")

    def test_create_new_dashboard_with_modified_widget_layout(self):
        with self.feature(FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE):
            # Create a new dashboard
            self.page.visit_create_dashboard()

            self.page.add_widget_through_dashboard("New Widget")

            # Drag to the right
            dragHandle = self.browser.element(WIDGET_DRAG_HANDLE)
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(dragHandle, 1000, 0).perform()

            self.page.save_dashboard()

            # Wait for page redirect, or else loading check passes too early
            wait = WebDriverWait(self.browser.driver, 10)
            wait.until(
                lambda driver: (
                    f"/organizations/{self.organization.slug}/dashboards/new/"
                    not in driver.current_url
                )
            )

            self.capture_screenshots("dashboards - save widget layout in new custom dashboard")

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
            self.page.visit_dashboard_detail()
            self.page.enter_edit_state()

            # Drag to the right
            dragHandle = self.browser.element(WIDGET_DRAG_HANDLE)
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(dragHandle, 1000, 0).perform()

            self.page.save_dashboard()

            self.capture_screenshots("dashboards - move existing widget on existing dashboard")

    def test_add_by_widget_library_do_not_overlap(self):
        with self.feature(
            FEATURE_NAMES + EDIT_FEATURE + WIDGET_LIBRARY_FEATURE + GRID_LAYOUT_FEATURE
        ):
            self.page.visit_dashboard_detail()
            self.page.click_dashboard_header_add_widget_button()

            self.browser.element('[data-test-id="library-tab"]').click()

            # Add library widgets
            self.browser.element('[data-test-id="widget-library-card-0"]').click()
            self.browser.element('[data-test-id="widget-library-card-2"]').click()
            self.browser.element('[data-test-id="widget-library-card-3"]').click()
            self.browser.element('[data-test-id="widget-library-card-2"]').click()
            self.browser.element('[data-test-id="confirm-widgets"]').click()

            self.capture_screenshots(
                "dashboards - widgets from widget library do not overlap when added"
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
            self.page.visit_dashboard_detail()
            self.page.enter_edit_state()

            # Drag existing widget to the right
            dragHandle = self.browser.element(WIDGET_DRAG_HANDLE)
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(dragHandle, 1000, 0).perform()

            # Edit the existing widget
            button = self.browser.element(EDIT_WIDGET_BUTTON)
            button.click()
            title_input = self.browser.element(WIDGET_TITLE_FIELD)
            title_input.send_keys(Keys.END, "UPDATED!!")
            button = self.browser.element('[data-test-id="add-widget"]')
            button.click()

            # Add and drag new widget to the right
            self.page.add_widget_through_dashboard("New Widget")
            dragHandle = self.browser.element(
                f".react-grid-item:nth-of-type(2) {WIDGET_DRAG_HANDLE}"
            )
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(dragHandle, 1000, 0)
            action.perform()

            # Edit the new widget
            button = self.browser.element(f".react-grid-item:nth-of-type(2) {EDIT_WIDGET_BUTTON}")
            button.click()
            title_input = self.browser.element(WIDGET_TITLE_FIELD)
            title_input.send_keys(Keys.END, "UPDATED!!")
            button = self.browser.element('[data-test-id="add-widget"]')
            button.click()

            self.page.save_dashboard()

            self.capture_screenshots(
                "dashboards - edit widgets after layout change does not reset layout"
            )

    def test_add_issue_widgets_do_not_overlap(self):
        def add_issue_widget(widget_title):
            self.browser.wait_until_clickable('[data-test-id="widget-add"]')
            self.page.click_dashboard_add_widget_button()
            title_input = self.browser.element(WIDGET_TITLE_FIELD)
            title_input.send_keys(widget_title)
            self.browser.element('[aria-label="issue"]').click()
            button = self.browser.element('[data-test-id="add-widget"]')
            button.click()

        with self.feature(
            FEATURE_NAMES + EDIT_FEATURE + ISSUE_WIDGET_FEATURE + GRID_LAYOUT_FEATURE
        ):
            self.page.visit_dashboard_detail()
            self.page.enter_edit_state()

            add_issue_widget("Issue Widget 1")
            add_issue_widget("Issue Widget 2")
            self.page.save_dashboard()

            self.capture_screenshots("dashboards - issue widgets do not overlap")

    def test_resize_new_and_existing_widgets(self):
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
            self.page.visit_dashboard_detail()
            self.page.enter_edit_state()

            # Resize existing widget
            resizeHandle = self.browser.element(WIDGET_RESIZE_HANDLE)
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(resizeHandle, 500, 0).perform()

            self.page.add_widget_through_dashboard("New Widget")

            # Drag it to the left for consistency
            dragHandle = self.browser.element(
                f".react-grid-item:nth-of-type(2) {WIDGET_DRAG_HANDLE}"
            )
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(dragHandle, -1000, 0).perform()

            # Resize new widget, get the 2nd element instead of the "last" because the "last" is
            # the add widget button
            resizeHandle = self.browser.element(
                f".react-grid-item:nth-of-type(2) {WIDGET_RESIZE_HANDLE}"
            )
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(resizeHandle, 500, 0).perform()

            self.page.save_dashboard()

            self.capture_screenshots("dashboards - resize new and existing widgets")

    def test_delete_existing_widget_does_not_trigger_new_widget_layout_reset(self):
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
            self.page.visit_dashboard_detail()
            self.page.enter_edit_state()

            self.page.add_widget_through_dashboard("New Widget")

            # Drag it to the bottom left
            dragHandle = self.browser.element(
                f".react-grid-item:nth-of-type(2) {WIDGET_DRAG_HANDLE}"
            )
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(dragHandle, -500, 500).perform()

            # Resize new widget, get the 2nd element instead of the "last" because the "last" is
            # the add widget button
            resizeHandle = self.browser.element(
                f".react-grid-item:nth-of-type(2) {WIDGET_RESIZE_HANDLE}"
            )
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(resizeHandle, 500, 0).perform()

            # Delete first existing widget
            delete_widget_button = self.browser.element(
                '.react-grid-item:first-of-type [data-test-id="widget-delete"]'
            )
            delete_widget_button.click()

            self.page.save_dashboard()

            self.capture_screenshots(
                "dashboards - delete existing widget does not reset new widget layout"
            )

    def test_resize_big_number_widget(self):
        existing_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="Big Number Widget",
            display_type=DashboardWidgetDisplayTypes.BIG_NUMBER,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
        )
        DashboardWidgetQuery.objects.create(
            widget=existing_widget, fields=["count_unique(issue)"], order=0
        )
        with self.feature(FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE):
            self.page.visit_dashboard_detail()
            self.page.enter_edit_state()

            # Resize existing widget
            resizeHandle = self.browser.element(WIDGET_RESIZE_HANDLE)
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(resizeHandle, 200, 200).perform()

            self.page.save_dashboard()

            self.capture_screenshots("dashboards - resize big number widget")

    def test_default_layout_when_widgets_do_not_have_layout_set(self):
        existing_widgets = DashboardWidget.objects.bulk_create(
            [
                DashboardWidget(
                    dashboard=self.dashboard,
                    order=i,
                    title=f"Existing Widget {i}",
                    display_type=DashboardWidgetDisplayTypes.LINE_CHART,
                    widget_type=DashboardWidgetTypes.DISCOVER,
                    interval="1d",
                )
                for i in range(4)
            ]
        )
        DashboardWidgetQuery.objects.bulk_create(
            [
                DashboardWidgetQuery(widget=existing_widget, fields=["count()"], order=0)
                for existing_widget in existing_widgets
            ]
        )

        with self.feature(FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE):
            self.page.visit_dashboard_detail()

            self.page.wait_until_loaded()
            self.browser.snapshot("dashboards - default layout when widgets do not have layout set")

    def test_duplicate_widget_in_view_mode(self):
        existing_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="Big Number Widget",
            display_type=DashboardWidgetDisplayTypes.BIG_NUMBER,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
        )
        DashboardWidgetQuery.objects.create(
            widget=existing_widget, fields=["count_unique(issue)"], order=0
        )
        with self.feature(FEATURE_NAMES + EDIT_FEATURE):
            self.page.visit_dashboard_detail()

            self.browser.element('[data-test-id="context-menu"]').click()
            self.browser.element('[data-test-id="duplicate-widget"]').click()
            self.page.wait_until_loaded()

            self.browser.elements('[data-test-id="context-menu"]')[0].click()
            self.browser.element('[data-test-id="duplicate-widget"]').click()
            self.page.wait_until_loaded()

            self.browser.snapshot("dashboard widget - duplicate")

    def test_delete_widget_in_view_mode(self):
        existing_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="Big Number Widget",
            display_type=DashboardWidgetDisplayTypes.BIG_NUMBER,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
        )
        DashboardWidgetQuery.objects.create(
            widget=existing_widget, fields=["count_unique(issue)"], order=0
        )
        with self.feature(FEATURE_NAMES + EDIT_FEATURE):
            self.page.visit_dashboard_detail()

            self.browser.element('[data-test-id="context-menu"]').click()
            self.browser.element('[data-test-id="delete-widget"]').click()
            self.browser.element('[data-test-id="confirm-button"]').click()

            self.page.wait_until_loaded()

            self.browser.snapshot("dashboard widget - delete")

    def test_cancel_without_changes_does_not_trigger_confirm_with_widget_library_through_header(
        self,
    ):
        with self.feature(
            FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE + WIDGET_LIBRARY_FEATURE
        ):
            self.page.visit_dashboard_detail()

            # Open widget library
            self.page.click_dashboard_header_add_widget_button()
            self.browser.element('[data-test-id="library-tab"]').click()

            # Select/deselect widget library cards
            self.browser.element('[data-test-id="widget-library-card-0"]').click()
            self.browser.element('[data-test-id="widget-library-card-2"]').click()

            # Save widget library selections
            button = self.browser.element('[data-test-id="confirm-widgets"]')
            button.click()
            self.page.wait_until_loaded()

            # Should not trigger alert
            self.page.enter_edit_state()
            self.page.click_cancel_button()
            wait = WebDriverWait(self.browser.driver, 5)
            wait.until_not(EC.alert_is_present())

    def test_cancel_without_changes_does_not_trigger_confirm_with_custom_widget_through_header(
        self,
    ):
        with self.feature(
            FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE + WIDGET_LIBRARY_FEATURE
        ):
            self.page.visit_dashboard_detail()

            self.page.click_dashboard_header_add_widget_button()
            title_input = self.browser.element(WIDGET_TITLE_FIELD)
            title_input.send_keys("New custom widget")
            button = self.browser.element('[data-test-id="add-widget"]')
            button.click()
            self.page.wait_until_loaded()

            # Should not trigger confirm dialog
            self.page.enter_edit_state()
            self.page.click_cancel_button()
            wait = WebDriverWait(self.browser.driver, 5)
            wait.until_not(EC.alert_is_present())

    def test_position_when_adding_multiple_widgets_through_add_widget_tile_in_edit(
        self,
    ):
        with self.feature(
            FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE + WIDGET_LIBRARY_FEATURE
        ):
            self.page.visit_dashboard_detail()
            self.page.enter_edit_state()

            # Widgets should take up the whole first row and the first spot in second row
            self.page.add_widget_through_dashboard("A")
            self.page.add_widget_through_dashboard("B")
            self.page.add_widget_through_dashboard("C")
            self.page.add_widget_through_dashboard("D")
            self.page.wait_until_loaded()

            self.browser.snapshot(
                "dashboards - pre save position when adding multiple widgets through Add Widget tile in edit"
            )

            self.page.save_dashboard()
            self.capture_screenshots(
                "dashboards - position when adding multiple widgets through Add Widget tile in edit"
            )

    def test_position_when_adding_multiple_widgets_through_add_widget_tile_in_create(
        self,
    ):
        with self.feature(
            FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE + WIDGET_LIBRARY_FEATURE
        ):
            self.page.visit_create_dashboard()

            # Widgets should take up the whole first row and the first spot in second row
            self.page.add_widget_through_dashboard("A")
            self.page.add_widget_through_dashboard("B")
            self.page.add_widget_through_dashboard("C")
            self.page.add_widget_through_dashboard("D")
            self.page.wait_until_loaded()

            self.browser.snapshot(
                "dashboards - pre save position when adding multiple widgets through Add Widget tile in create"
            )

            self.page.save_dashboard()

            # Wait for page redirect, or else loading check passes too early
            wait = WebDriverWait(self.browser.driver, 10)
            wait.until(
                lambda driver: (
                    f"/organizations/{self.organization.slug}/dashboards/new/"
                    not in driver.current_url
                )
            )
            self.capture_screenshots(
                "dashboards - position when adding multiple widgets through Add Widget tile in create"
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
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until_not('[data-test-id="loading-placeholder"]')

    def test_dashboard_manager(self):
        with self.feature(FEATURE_NAMES + EDIT_FEATURE):
            self.browser.get(self.default_path)
            self.wait_until_loaded()
            self.browser.snapshot("dashboards - manage overview")
