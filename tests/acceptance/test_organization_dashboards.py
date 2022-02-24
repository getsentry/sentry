from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
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

            self.browser.element('[aria-haspopup="true"]').click()
            self.browser.element('[data-test-id="duplicate-widget"]').click()
            self.page.wait_until_loaded()

            self.browser.element('[aria-haspopup="true"]').click()
            self.browser.element('[data-test-id="duplicate-widget"]').click()
            self.page.wait_until_loaded()

            self.browser.snapshot("dashboard widget - duplicate")

    def test_delete_widget_in_view_mode(self):
        with self.feature(FEATURE_NAMES + EDIT_FEATURE):
            self.page.visit_dashboard_detail()

            self.browser.element('[aria-haspopup="true"]').click()
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

    def test_default_overview_dashboard_layout(self):
        with self.feature(FEATURE_NAMES + GRID_LAYOUT_FEATURE):
            self.page.visit_default_overview()
            self.browser.snapshot("dashboards - default overview layout")

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
            self.browser.element(
                '[aria-label="Select Issues (States, Assignment, Time, etc.)"]'
            ).click()
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

            self.browser.element('[aria-haspopup="true"]').click()
            self.browser.element('[data-test-id="duplicate-widget"]').click()
            self.page.wait_until_loaded()

            self.browser.element('[aria-haspopup="true"]').click()
            self.browser.element('[data-test-id="duplicate-widget"]').click()
            self.page.wait_until_loaded()

            # Should not trigger alert
            self.page.enter_edit_state()
            self.page.click_cancel_button()
            wait = WebDriverWait(self.browser.driver, 5)
            wait.until_not(EC.alert_is_present())

            self.browser.snapshot("dashboard widget - duplicate with grid")

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

            self.browser.element('[aria-haspopup="true"]').click()
            self.browser.element('[data-test-id="delete-widget"]').click()
            self.browser.element('[data-test-id="confirm-button"]').click()

            self.page.wait_until_loaded()

            self.browser.snapshot("dashboard widget - delete with grid")

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

    def test_deleting_stacked_widgets_by_context_menu_does_not_trigger_confirm_on_edit_cancel(
        self,
    ):
        layouts = [
            {"x": 0, "y": 0, "w": 2, "h": 2, "minH": 2},
            {"x": 0, "y": 2, "w": 2, "h": 2, "minH": 2},
        ]
        existing_widgets = DashboardWidget.objects.bulk_create(
            [
                DashboardWidget(
                    dashboard=self.dashboard,
                    order=i,
                    title=f"Existing Widget {i}",
                    display_type=DashboardWidgetDisplayTypes.LINE_CHART,
                    widget_type=DashboardWidgetTypes.DISCOVER,
                    interval="1d",
                    detail={"layout": layout},
                )
                for i, layout in enumerate(layouts)
            ]
        )
        DashboardWidgetQuery.objects.bulk_create(
            DashboardWidgetQuery(widget=widget, fields=["count()"], order=0)
            for widget in existing_widgets
        )
        with self.feature(
            FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE + WIDGET_LIBRARY_FEATURE
        ):
            self.page.visit_dashboard_detail()

            dropdown_trigger = self.browser.element('[aria-haspopup="true"]')
            dropdown_trigger.click()

            delete_widget_menu_item = self.browser.element('[data-test-id="delete-widget"]')
            delete_widget_menu_item.click()

            confirm_button = self.browser.element('[data-test-id="confirm-button"]')
            confirm_button.click()

            wait = WebDriverWait(self.browser.driver, 5)
            wait.until(
                EC.presence_of_element_located(
                    (By.XPATH, "//*[contains(text(),'Dashboard updated')]")
                )
            )

            # Should not trigger confirm dialog
            self.page.enter_edit_state()
            self.page.click_cancel_button()
            wait.until_not(EC.alert_is_present())

    def test_changing_number_widget_to_area_updates_widget_height(
        self,
    ):
        layouts = [
            {"x": 0, "y": 0, "w": 2, "h": 1, "minH": 1},
            {"x": 0, "y": 1, "w": 2, "h": 1, "minH": 1},
        ]
        existing_widgets = DashboardWidget.objects.bulk_create(
            [
                DashboardWidget(
                    dashboard=self.dashboard,
                    order=i,
                    title=f"Big Number {i}",
                    display_type=DashboardWidgetDisplayTypes.BIG_NUMBER,
                    widget_type=DashboardWidgetTypes.DISCOVER,
                    interval="1d",
                    detail={"layout": layout},
                )
                for i, layout in enumerate(layouts)
            ]
        )
        DashboardWidgetQuery.objects.bulk_create(
            DashboardWidgetQuery(widget=widget, fields=["count()"], order=0)
            for widget in existing_widgets
        )
        with self.feature(
            FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE + WIDGET_LIBRARY_FEATURE
        ):
            self.page.visit_dashboard_detail()

            # Open edit modal for first widget
            dropdown_trigger = self.browser.element('[aria-haspopup="true"]')
            dropdown_trigger.click()
            edit_widget_menu_item = self.browser.element('[data-test-id="edit-widget"]')
            edit_widget_menu_item.click()

            # Change the chart type to the first visualization option - Area chart
            chart_type_input = self.browser.element("#react-select-2-input")
            chart_type_input.send_keys("Area", Keys.ENTER)
            button = self.browser.element('[data-test-id="add-widget"]')
            button.click()

            # No confirm dialog because of shifting lower element
            self.page.enter_edit_state()
            self.page.click_cancel_button()
            wait = WebDriverWait(self.browser.driver, 5)
            wait.until_not(EC.alert_is_present())

            # Try to decrease height to 1 row, should stay at 2 rows
            self.page.enter_edit_state()
            resizeHandle = self.browser.element(WIDGET_RESIZE_HANDLE)
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(resizeHandle, 0, -100).perform()

            self.page.save_dashboard()

            self.browser.snapshot(
                "dashboards - change from big number to area chart increases widget to min height"
            )

    def test_changing_number_widget_larger_than_min_height_for_area_chart_keeps_height(
        self,
    ):
        existing_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="Originally Big Number - 3 rows",
            display_type=DashboardWidgetDisplayTypes.BIG_NUMBER,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 2, "h": 3, "minH": 1}},
        )
        DashboardWidgetQuery.objects.create(widget=existing_widget, fields=["count()"], order=0)
        with self.feature(
            FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE + WIDGET_LIBRARY_FEATURE
        ):
            self.page.visit_dashboard_detail()

            # Open edit modal for first widget
            dropdown_trigger = self.browser.element('[aria-haspopup="true"]')
            dropdown_trigger.click()
            edit_widget_menu_item = self.browser.element('[data-test-id="edit-widget"]')
            edit_widget_menu_item.click()

            # Change the chart type to the first visualization option - Area chart
            chart_type_input = self.browser.element("#react-select-2-input")
            chart_type_input.send_keys("Area", Keys.ENTER)
            button = self.browser.element('[data-test-id="add-widget"]')
            button.click()

            self.page.wait_until_loaded()

            self.browser.snapshot(
                "dashboards - change from big number to other chart of more than 2 rows keeps height"
            )

            # Try to decrease height by >1 row, should be at 2 rows
            self.page.enter_edit_state()
            resizeHandle = self.browser.element(WIDGET_RESIZE_HANDLE)
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(resizeHandle, 0, -400).perform()

            self.page.save_dashboard()

            self.browser.snapshot(
                "dashboards - change from big number to other chart enforces min height of 2"
            )

    def test_changing_area_widget_larger_than_min_height_for_number_chart_keeps_height(
        self,
    ):
        existing_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="Originally Area Chart - 3 rows",
            display_type=DashboardWidgetDisplayTypes.AREA_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 2, "h": 3, "minH": 2}},
        )
        DashboardWidgetQuery.objects.create(widget=existing_widget, fields=["count()"], order=0)
        with self.feature(
            FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE + WIDGET_LIBRARY_FEATURE
        ):
            self.page.visit_dashboard_detail()

            # Open edit modal for first widget
            dropdown_trigger = self.browser.element('[aria-haspopup="true"]')
            dropdown_trigger.click()
            edit_widget_menu_item = self.browser.element('[data-test-id="edit-widget"]')
            edit_widget_menu_item.click()

            # Change the chart type to big number
            chart_type_input = self.browser.element("#react-select-2-input")
            chart_type_input.send_keys("Big Number", Keys.ENTER)
            button = self.browser.element('[data-test-id="add-widget"]')
            button.click()

            self.page.wait_until_loaded()

            self.browser.snapshot("dashboards - change from area chart to big number keeps height")

            # Decrease height by >1 row, should stop at 1 row
            self.page.enter_edit_state()
            resizeHandle = self.browser.element(WIDGET_RESIZE_HANDLE)
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(resizeHandle, 0, -400).perform()

            self.page.save_dashboard()

            self.browser.snapshot(
                "dashboards - change from area chart to big number allows min height of 1"
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

    def test_dashboard_manager_with_unset_layouts_and_defined_layouts(self):
        dashboard_with_layouts = Dashboard.objects.create(
            title="Dashboard with some defined layouts",
            created_by=self.user,
            organization=self.organization,
        )
        DashboardWidget.objects.create(
            dashboard=dashboard_with_layouts,
            order=0,
            title="Widget 1",
            display_type=DashboardWidgetDisplayTypes.BAR_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 1, "y": 0, "w": 3, "h": 3, "minH": 2}},
        )

        # This widget has no layout, but should position itself at
        # x: 4, y: 0, w: 2, h: 2
        DashboardWidget.objects.create(
            dashboard=dashboard_with_layouts,
            order=1,
            title="Widget 2",
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
        )

        with self.feature(FEATURE_NAMES + EDIT_FEATURE + GRID_LAYOUT_FEATURE):
            self.browser.get(self.default_path)
            self.wait_until_loaded()
            self.browser.snapshot("dashboards - manage overview with grid layout")
