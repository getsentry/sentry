from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class OrganizationTelemetryClassifierDetailsGetTest(APITestCase):
    endpoint = "sentry-api-0-organization-telemetry-classifier-details"
    features = {"organizations:classifiers-ui": True}

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.classifier = self.create_telemetry_classifier(
            name="Frustration",
            result_attribute="sentry.classifier.frustration",
            filter_query="gen_ai.agent.name:support",
            created_by_id=self.user.id,
        )

    def test_requires_feature(self) -> None:
        self.get_error_response(self.organization.slug, self.classifier.id, status_code=404)

    def test_returns_classifier(self) -> None:
        with self.feature(self.features):
            response = self.get_success_response(self.organization.slug, self.classifier.id)

        assert response.data.pop("createdBy")["id"] == str(self.user.id)
        assert response.data == {
            "id": str(self.classifier.id),
            "projectId": str(self.project.id),
            "name": "Frustration",
            "resultAttribute": "sentry.classifier.frustration",
            "dataset": "conversation",
            "filterQuery": "gen_ai.agent.name:support",
            "status": "enabled",
            "prebuiltClassifierKey": None,
            "naturalLanguagePrompt": "Is the user frustrated?",
            "outputType": "binary",
            "dateAdded": self.classifier.date_added,
            "dateUpdated": self.classifier.date_updated,
        }

    def test_unknown_or_invalid_id(self) -> None:
        with self.feature(self.features):
            self.get_error_response(self.organization.slug, self.classifier.id + 1, status_code=404)
            self.get_error_response(self.organization.slug, "not-an-id", status_code=404)

    def test_classifier_in_other_organization(self) -> None:
        other_org = self.create_organization()
        other = self.create_telemetry_classifier(
            project=self.create_project(organization=other_org)
        )

        with self.feature(self.features):
            self.get_error_response(self.organization.slug, other.id, status_code=404)

    def test_classifier_on_inaccessible_project(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        member = self.create_user()
        self.create_member(
            organization=self.organization, user=member, role="member", teams=[self.team]
        )
        hidden = self.create_telemetry_classifier(
            project=self.create_project(
                organization=self.organization,
                teams=[self.create_team(organization=self.organization)],
            )
        )
        self.login_as(member)

        with self.feature(self.features):
            self.get_success_response(self.organization.slug, self.classifier.id)
            self.get_error_response(self.organization.slug, hidden.id, status_code=404)
