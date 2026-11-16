from sentry.telemetry_classifiers.prebuilt import PREBUILT_CLASSIFIERS
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class OrganizationPrebuiltTelemetryClassifiersTest(APITestCase):
    endpoint = "sentry-api-0-organization-prebuilt-telemetry-classifiers"
    features = {"organizations:classifiers-ui": True}

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_requires_feature(self) -> None:
        self.get_error_response(self.organization.slug, status_code=404)

    def test_lists_prebuilt_classifiers(self) -> None:
        with self.feature(self.features):
            response = self.get_success_response(self.organization.slug)

        assert [c["key"] for c in response.data] == list(PREBUILT_CLASSIFIERS)
        assert response.data[0] == {
            "key": "conversation_user_frustration",
            "dataset": "conversation",
            "name": "User frustration",
            "description": "When your users become frustrated with the agent they are speaking with.",
            "resultAttribute": "user_frustration",
        }

    def test_filters_by_dataset(self) -> None:
        with self.feature(self.features):
            conversation = self.get_success_response(self.organization.slug, dataset="conversation")
            trace_spans = self.get_success_response(self.organization.slug, dataset="trace_spans")

        assert [c["key"] for c in conversation.data] == ["conversation_user_frustration"]
        assert trace_spans.data == []

    def test_rejects_unknown_dataset(self) -> None:
        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug, dataset="unknown", status_code=400
            )

        assert "dataset" in response.data

    def test_member_can_list(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)

        with self.feature(self.features):
            self.get_success_response(self.organization.slug)
