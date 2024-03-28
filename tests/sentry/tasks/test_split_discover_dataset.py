from sentry.models.dashboard_widget import DashboardWidgetTypes
from sentry.tasks.split_discover_dataset import schedule_widget_discover_split
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.on_demand import create_widget
from sentry.utils.samples import load_data


class SplitDiscoverDatasetTest(SnubaTestCase, TestCase):
    def test_schedule_split_discover_dataset(self):

        project = self.create_project()
        _, widget_both, dashboard = create_widget(["count()"], "", project, id=1)
        _, widget_txn, __ = create_widget(
            ["count()"],
            "event.type:transaction",
            project,
            id=2,
            dashboard=dashboard,
        )
        _, widget_error, __ = create_widget(
            ["count()"], "event.type:error", project, id=3, dashboard=dashboard
        )

        dashboard.projects.add(project)
        dashboard.save()

        self.store_event(
            data=load_data("transaction", timestamp=before_now(hours=6)),
            project_id=project.id,
        )
        self.store_event(
            data=load_data("transaction", timestamp=before_now(hours=5)),
            project_id=project.id,
        )

        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": before_now(hours=5).timestamp(),
                "fingerprint": ["group-1"],
                "exception": {"values": [{"type": "Error", "value": "error"}]},
            },
            project_id=project.id,
        )

        with override_options(
            {
                "split_discover_dataset.enable": True,
                "split_discover_dataset.rollout": 100,
                "split_discover_dataset.query.total_batches": 1,
                "split_discover_dataset.query.batch_size": 5,
            }
        ):
            schedule_widget_discover_split()

            widget_both.refresh_from_db()
            widget_txn.refresh_from_db()
            widget_error.refresh_from_db()

            assert widget_both.discover_widget_split is None
            assert widget_txn.discover_widget_split == DashboardWidgetTypes.TRANSACTION_LIKE
            assert widget_error.discover_widget_split == DashboardWidgetTypes.ERROR_EVENTS
