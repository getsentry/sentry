from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.incidents.grouptype import MetricIssue
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


class OrganizationIncidentGroupOpenPeriodAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-incident-groupopenperiod-index"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

        # Create groups and incidents
        self.group_1 = self.create_group(type=MetricIssue.type_id)
        self.group_2 = self.create_group(type=MetricIssue.type_id)
        self.group_3 = self.create_group(type=MetricIssue.type_id)

        # Get the open periods created automatically with the groups
        self.open_period_1 = GroupOpenPeriod.objects.get(group=self.group_1)
        self.open_period_2 = GroupOpenPeriod.objects.get(group=self.group_2)
        self.open_period_3 = GroupOpenPeriod.objects.get(group=self.group_3)

        # Create incidents
        self.alert_rule = self.create_alert_rule()
        self.incident_1 = self.create_incident(
            organization=self.organization, projects=[self.project], alert_rule=self.alert_rule
        )
        self.incident_2 = self.create_incident(
            organization=self.organization, projects=[self.project], alert_rule=self.alert_rule
        )
        self.incident_3 = self.create_incident(
            organization=self.organization, projects=[self.project], alert_rule=self.alert_rule
        )

        # Create incident-group-open-period relationships
        self.igop_1 = self.create_incident_group_open_period(
            incident=self.incident_1, group_open_period=self.open_period_1
        )
        self.igop_2 = self.create_incident_group_open_period(
            incident=self.incident_2, group_open_period=self.open_period_2
        )
        self.igop_3 = self.create_incident_group_open_period(
            incident=self.incident_3, group_open_period=self.open_period_3
        )


@region_silo_test
class OrganizationIncidentGroupOpenPeriodIndexGetTest(
    OrganizationIncidentGroupOpenPeriodAPITestCase
):
    def test_get_with_incident_id_filter(self) -> None:
        response = self.get_success_response(
            self.organization.slug, incident_id=str(self.incident_1.id)
        )
        assert response.data == serialize(self.igop_1, self.user)

    def test_get_with_incident_identifier_filter(self) -> None:
        response = self.get_success_response(
            self.organization.slug, incident_identifier=str(self.incident_1.identifier)
        )
        assert response.data == serialize(self.igop_1, self.user)

    def test_get_with_group_id_filter(self) -> None:
        response = self.get_success_response(self.organization.slug, group_id=str(self.group_2.id))
        assert response.data == serialize(self.igop_2, self.user)

    def test_get_with_open_period_id_filter(self) -> None:
        response = self.get_success_response(
            self.organization.slug, open_period_id=str(self.open_period_3.id)
        )
        assert response.data == serialize(self.igop_3, self.user)

    def test_get_with_multiple_filters(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            incident_id=str(self.incident_1.id),
            group_id=str(self.group_1.id),
        )
        assert response.data == serialize(self.igop_1, self.user)

    def test_get_with_multiple_filters_with_invalid_filter(self) -> None:
        self.get_error_response(
            self.organization.slug,
            incident_id=str(self.incident_1.id),
            group_id="99999",
        )

    def test_get_with_nonexistent_incident_id(self) -> None:
        self.get_error_response(self.organization.slug, incident_id="99999", status_code=404)

    def test_get_with_nonexistent_incident_identifier(self) -> None:
        self.get_error_response(
            self.organization.slug, incident_identifier="99999", status_code=404
        )

    def test_get_with_nonexistent_group_id(self) -> None:
        self.get_error_response(self.organization.slug, group_id="99999", status_code=404)

    def test_get_with_nonexistent_open_period_id(self) -> None:
        self.get_error_response(self.organization.slug, open_period_id="99999", status_code=404)

    def test_no_filter_provided(self) -> None:
        self.get_error_response(self.organization.slug, status_code=400)

    def test_fallback_with_fake_incident_identifier(self) -> None:
        """
        Test that when an IGOP doesn't exist, the endpoint falls back to looking up
        the GroupOpenPeriod by subtracting 10^9 from the incident_identifier.
        This is the reverse of the GOP -> Incident serialization logic.
        """
        # Create a group with open period but NO IGOP
        group_no_igop = self.create_group(type=MetricIssue.type_id)
        open_period_no_igop = GroupOpenPeriod.objects.get(group=group_no_igop)

        # Calculate the fake incident_identifier (same as serializer does)
        fake_incident_identifier = get_fake_id_from_object_id(open_period_no_igop.id)

        # Query using the fake incident_identifier
        response = self.get_success_response(
            self.organization.slug, incident_identifier=str(fake_incident_identifier)
        )

        # Should return a fake IGOP response
        assert response.data == {
            "incidentId": str(fake_incident_identifier),
            "incidentIdentifier": str(fake_incident_identifier),
            "groupId": str(group_no_igop.id),
            "openPeriodId": str(open_period_no_igop.id),
        }

    def test_fallback_with_nonexistent_open_period(self) -> None:
        # Use a fake incident_identifier that won't map to any real open period
        nonexistent_fake_id = get_fake_id_from_object_id(999999)
        self.get_error_response(
            self.organization.slug, incident_identifier=str(nonexistent_fake_id), status_code=404
        )
