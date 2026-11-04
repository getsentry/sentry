from sentry.telemetry_classifiers.models import (
    TelemetryClassifierDataset,
    TelemetryClassifierStatus,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class OrganizationTelemetryClassifiersTest(APITestCase):
    endpoint = "sentry-api-0-organization-telemetry-classifiers"
    features = {"organizations:classifiers-ui": True}

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_requires_feature(self) -> None:
        self.create_telemetry_classifier()

        self.get_error_response(self.organization.slug, status_code=404)

    def test_lists_classifiers_newest_first(self) -> None:
        custom = self.create_telemetry_classifier(
            name="Frustration",
            result_attribute="sentry.classifier.frustration",
            filter_query="gen_ai.agent.name:support",
            created_by_id=self.user.id,
        )
        prebuilt = self.create_telemetry_classifier(
            name="Refusals",
            dataset=TelemetryClassifierDataset.TRACE_SPANS,
            status=TelemetryClassifierStatus.DISABLED,
            prebuilt_classifier_key="refusal",
            natural_language_prompt=None,
            compiled_prompt=None,
            output_type=None,
        )

        with self.feature(self.features):
            response = self.get_success_response(self.organization.slug)

        assert [c["id"] for c in response.data] == [str(prebuilt.id), str(custom.id)]
        custom_data, prebuilt_data = response.data[1], response.data[0]
        assert custom_data.pop("createdBy")["id"] == str(self.user.id)
        assert custom_data == {
            "id": str(custom.id),
            "projectId": str(self.project.id),
            "name": "Frustration",
            "resultAttribute": "sentry.classifier.frustration",
            "dataset": "conversation",
            "filterQuery": "gen_ai.agent.name:support",
            "status": "enabled",
            "prebuiltClassifierKey": None,
            "naturalLanguagePrompt": "Is the user frustrated?",
            "outputType": "binary",
            "dateAdded": custom.date_added,
            "dateUpdated": custom.date_updated,
        }
        assert prebuilt_data["dataset"] == "trace_spans"
        assert prebuilt_data["status"] == "disabled"
        assert prebuilt_data["prebuiltClassifierKey"] == "refusal"
        assert prebuilt_data["naturalLanguagePrompt"] is None
        assert prebuilt_data["outputType"] is None
        assert prebuilt_data["createdBy"] is None

    def test_filters_by_project(self) -> None:
        other_project = self.create_project(organization=self.organization, teams=[self.team])
        self.create_telemetry_classifier()
        other = self.create_telemetry_classifier(project=other_project)

        with self.feature(self.features):
            response = self.get_success_response(self.organization.slug, project=[other_project.id])

        assert [c["id"] for c in response.data] == [str(other.id)]

    def test_excludes_other_organizations(self) -> None:
        own = self.create_telemetry_classifier()
        other_org = self.create_organization()
        self.create_telemetry_classifier(project=self.create_project(organization=other_org))

        with self.feature(self.features):
            response = self.get_success_response(self.organization.slug, project=[-1])

        assert [c["id"] for c in response.data] == [str(own.id)]

    def test_excludes_inaccessible_projects(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        member = self.create_user()
        self.create_member(
            organization=self.organization, user=member, role="member", teams=[self.team]
        )
        hidden_project = self.create_project(
            organization=self.organization, teams=[self.create_team(organization=self.organization)]
        )
        visible = self.create_telemetry_classifier()
        self.create_telemetry_classifier(project=hidden_project)
        self.login_as(member)

        with self.feature(self.features):
            response = self.get_success_response(self.organization.slug, project=[-1])

        assert [c["id"] for c in response.data] == [str(visible.id)]

    def test_paginates(self) -> None:
        older = self.create_telemetry_classifier()
        newer = self.create_telemetry_classifier()

        with self.feature(self.features):
            first = self.get_success_response(self.organization.slug, per_page=1)
            assert [c["id"] for c in first.data] == [str(newer.id)]

            second = self.get_success_response(
                self.organization.slug, per_page=1, cursor=self.get_cursor_headers(first)[1]
            )

        assert [c["id"] for c in second.data] == [str(older.id)]
