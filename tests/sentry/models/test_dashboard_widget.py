from sentry.models.dashboard_widget import DashboardWidget
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_get_for_metrics():
    organization = Factories.create_organization()
    dashboard = Factories.create_dashboard(organization=organization)
    dashboard_widget = Factories.create_dashboard_widget(dashboard=dashboard, order=0)
    Factories.create_dashboard_widget_query(
        widget=dashboard_widget, aggregates=["count(c:foo/1)"], order=1
    )
    dashboard_widget2 = Factories.create_dashboard_widget(dashboard=dashboard, order=2)
    Factories.create_dashboard_widget_query(
        widget=dashboard_widget2, aggregates=["count(c:bar/2)"], order=2
    )

    organization2 = Factories.create_organization()
    dashboard2 = Factories.create_dashboard(organization=organization2)
    dashboard_widget2 = Factories.create_dashboard_widget(dashboard=dashboard2, order=0)
    Factories.create_dashboard_widget_query(
        widget=dashboard_widget2, aggregates=["count(c:foo/1)"], order=1
    )

    assert DashboardWidget.objects.get_for_metrics(organization, ["count(c:foo/1)"]).count() == 1
    assert DashboardWidget.objects.get_for_metrics(organization, ["count(c:bar/2)"]).count() == 1
    assert DashboardWidget.objects.get_for_metrics(organization2, ["count(c:foo/1)"]).count() == 1

    assert (
        DashboardWidget.objects.get_for_metrics(
            organization, ["count(c:foo/1)", "count(c:bar/2)"]
        ).count()
        == 2
    )
