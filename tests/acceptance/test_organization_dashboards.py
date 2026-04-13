import pytest
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

from fixtures.page_objects.dashboard_detail import (
    WIDGET_DRAG_HANDLE,
    WIDGET_RESIZE_HANDLE,
    DashboardDetailPage,
)
from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import no_silo_test

FEATURE_NAMES = [
    "organizations:performance-view",
    "organizations:discover-basic",
    "organizations:discover-query",
    "organizations:dashboards-basic",
]

EDIT_FEATURE = ["organizations:dashboards-edit"]


pytestmark = pytest.mark.sentry_metrics


@no_silo_test
class OrganizationDashboardsAcceptanceTest(AcceptanceTestCase):
    def setUp(self) -> None:
        super().setUp()
        # Prevent single-project auto-select from changing page filter behavior,
        # which can cause the platform icon to overlap widget interaction targets.
        self.create_project(organization=self.organization, name="Second Project")
        min_ago = before_now(minutes=1).isoformat()
        self.store_event(
            data={"event_id": "a" * 32, "message": "oh no", "timestamp": min_ago},
            project_id=self.project.id,
        )
        self.dashboard = Dashboard.objects.create(
            title="Dashboard 1", created_by_id=self.user.id, organization=self.organization
        )
        self.page = DashboardDetailPage(
            self.browser, self.client, organization=self.organization, dashboard=self.dashboard
        )
        self.login_as(self.user)

    def capture_screenshots(self, screenshot_name: str) -> None:
        """
        Refreshes the page and waits for load to verify layout persists after saving.
        """
        self.page.wait_until_loaded()
        self.browser.refresh()
        self.page.wait_until_loaded()

    def test_move_existing_widget_on_existing_dashboard(self) -> None:
        existing_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            title="Existing Widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
            interval="1d",
        )
        DashboardWidgetQuery.objects.create(
            widget=existing_widget, fields=["count()"], columns=[], aggregates=["count()"], order=0
        )
        with self.feature(FEATURE_NAMES + EDIT_FEATURE):
            self.page.visit_dashboard_detail()
            self.page.enter_edit_state()

            # Drag to the right
            dragHandle = self.browser.element(WIDGET_DRAG_HANDLE)
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(dragHandle, 1000, 0).perform()

            self.page.save_dashboard()

            self.capture_screenshots("dashboards - move existing widget on existing dashboard")

    def test_resize_big_number_widget(self) -> None:
        existing_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            title="Big Number Widget",
            display_type=DashboardWidgetDisplayTypes.BIG_NUMBER,
            widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
            interval="1d",
        )
        DashboardWidgetQuery.objects.create(
            widget=existing_widget,
            fields=["count_unique(issue)"],
            columns=[],
            aggregates=["count_unique(issue)"],
            order=0,
        )
        with self.feature(FEATURE_NAMES + EDIT_FEATURE):
            self.page.visit_dashboard_detail()
            self.page.enter_edit_state()

            # Resize existing widget
            resizeHandle = self.browser.element(WIDGET_RESIZE_HANDLE)
            action = ActionChains(self.browser.driver)
            action.drag_and_drop_by_offset(resizeHandle, 200, 200).perform()

            self.page.save_dashboard()

            self.capture_screenshots("dashboards - resize big number widget")

    def test_delete_widget_in_view_mode(self) -> None:
        existing_widget = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            title="Big Number Widget",
            display_type=DashboardWidgetDisplayTypes.BIG_NUMBER,
            widget_type=DashboardWidgetTypes.ERROR_EVENTS,
            interval="1d",
        )
        DashboardWidgetQuery.objects.create(
            widget=existing_widget,
            fields=["count_unique(issue)"],
            columns=[],
            aggregates=["count_unique(issue)"],
            order=0,
        )
        with self.feature(FEATURE_NAMES + EDIT_FEATURE):
            self.page.visit_dashboard_detail()

            # Hover over the widget to show widget actions
            self.browser.move_to('[aria-label="Widget panel"]')

            self.browser.element('[aria-label="Widget actions"]').click()
            self.browser.element('[data-test-id="delete-widget"]').click()
            self.browser.element('[data-test-id="confirm-button"]').click()

            self.page.wait_until_loaded()

    def test_deleting_stacked_widgets_by_context_menu_does_not_trigger_confirm_on_edit_cancel(
        self,
    ) -> None:
        layouts = [
            {"x": 0, "y": 0, "w": 2, "h": 2, "minH": 2},
            {"x": 0, "y": 2, "w": 2, "h": 2, "minH": 2},
        ]
        existing_widgets = DashboardWidget.objects.bulk_create(
            [
                DashboardWidget(
                    dashboard=self.dashboard,
                    title=f"Existing Widget {i}",
                    display_type=DashboardWidgetDisplayTypes.LINE_CHART,
                    widget_type=DashboardWidgetTypes.TRANSACTION_LIKE,
                    interval="1d",
                    detail={"layout": layout},
                )
                for i, layout in enumerate(layouts)
            ]
        )
        DashboardWidgetQuery.objects.bulk_create(
            DashboardWidgetQuery(
                widget=widget, fields=["count()"], columns=[], aggregates=["count()"], order=0
            )
            for widget in existing_widgets
        )
        with self.feature(FEATURE_NAMES + EDIT_FEATURE):
            self.page.visit_dashboard_detail()

            # Hover over the widget to show widget actions
            self.browser.move_to('[aria-label="Widget panel"]')

            dropdown_trigger = self.browser.element('[aria-label="Widget actions"]')
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
