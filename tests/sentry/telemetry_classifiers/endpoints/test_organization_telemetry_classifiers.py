from typing import Any

from sentry.telemetry_classifiers.models import TelemetryClassifier
from sentry.telemetry_classifiers.types import Dataset, TelemetryClassifierStatus
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
            result_attribute="frustration",
            filter_query="gen_ai.agent.name:support",
            created_by_id=self.user.id,
        )
        prebuilt = self.create_telemetry_classifier(
            name="Refusals",
            dataset=Dataset.TRACE_SPANS,
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
            "resultAttribute": "frustration",
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


@cell_silo_test
class OrganizationTelemetryClassifiersCreateTest(APITestCase):
    endpoint = "sentry-api-0-organization-telemetry-classifiers"
    method = "post"
    features = {"organizations:classifiers-ui": True}

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def payload(self, **overrides: Any) -> dict[str, Any]:
        return {
            "project": self.project.id,
            "name": "Frustration",
            "resultAttribute": "frustration",
            "dataset": "conversation",
            "filterQuery": "gen_ai.agent.name:support",
            "prebuiltClassifierKey": "conversation_user_frustration",
            **overrides,
        }

    def test_requires_feature(self) -> None:
        self.get_error_response(self.organization.slug, **self.payload(), status_code=404)

        assert not TelemetryClassifier.objects.exists()

    def test_creates_prebuilt_classifier(self) -> None:
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug, **self.payload(), status_code=201
            )

        classifier = TelemetryClassifier.objects.get(id=response.data["id"])
        assert classifier.project_id == self.project.id
        assert classifier.created_by_id == self.user.id
        assert response.data.pop("createdBy")["id"] == str(self.user.id)
        assert response.data == {
            "id": str(classifier.id),
            "projectId": str(self.project.id),
            "name": "Frustration",
            "resultAttribute": "frustration",
            "dataset": "conversation",
            "filterQuery": "gen_ai.agent.name:support",
            "status": "enabled",
            "prebuiltClassifierKey": "conversation_user_frustration",
            "naturalLanguagePrompt": None,
            "outputType": None,
            "dateAdded": classifier.date_added,
            "dateUpdated": classifier.date_updated,
        }

    def test_accepts_project_slug_and_optional_fields(self) -> None:
        payload = self.payload(project=self.project.slug, status="disabled")
        del payload["filterQuery"]

        with self.feature(self.features):
            response = self.get_success_response(self.organization.slug, **payload, status_code=201)

        assert response.data["projectId"] == str(self.project.id)
        assert response.data["status"] == "disabled"
        assert response.data["filterQuery"] == ""

    def test_rejects_custom_classifier(self) -> None:
        custom = self.payload(naturalLanguagePrompt="Is the user frustrated?", outputType="binary")

        with self.feature(self.features):
            response = self.get_error_response(self.organization.slug, **custom, status_code=400)
            assert response.data["nonFieldErrors"] == ["Custom classifiers aren't supported yet."]

            del custom["prebuiltClassifierKey"]
            response = self.get_error_response(self.organization.slug, **custom, status_code=400)
            assert "prebuiltClassifierKey" in response.data

        assert not TelemetryClassifier.objects.exists()

    def test_rejects_unknown_prebuilt_classifier_key(self) -> None:
        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug,
                **self.payload(prebuiltClassifierKey="unknown"),
                status_code=400,
            )

        assert "prebuiltClassifierKey" in response.data
        assert not TelemetryClassifier.objects.exists()

    def test_rejects_prebuilt_classifier_for_other_dataset(self) -> None:
        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug, **self.payload(dataset="trace_spans"), status_code=400
            )

        assert response.data["prebuiltClassifierKey"] == [
            "This prebuilt classifier doesn't support this dataset."
        ]
        assert not TelemetryClassifier.objects.exists()

    def test_rejects_duplicate_result_attribute_in_project(self) -> None:
        self.create_telemetry_classifier(project=self.project, result_attribute="frustration")
        other_project = self.create_project(organization=self.organization, teams=[self.team])

        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug, **self.payload(), status_code=400
            )
            assert "resultAttribute" in response.data

            self.get_success_response(
                self.organization.slug, **self.payload(project=other_project.id), status_code=201
            )

    def test_rejects_invalid_result_attribute(self) -> None:
        invalid = ["", "Frustration", "user frustration", ".frustration", "a..b", "a.", "é"]

        with self.feature(self.features):
            for result_attribute in invalid:
                response = self.get_error_response(
                    self.organization.slug,
                    **self.payload(resultAttribute=result_attribute),
                    status_code=400,
                )
                assert "resultAttribute" in response.data, result_attribute

        assert not TelemetryClassifier.objects.exists()

    def test_accepts_dotted_result_attribute(self) -> None:
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                **self.payload(resultAttribute="agent.user_frustration_2"),
                status_code=201,
            )

        assert response.data["resultAttribute"] == "agent.user_frustration_2"

    def test_accepts_conversation_aggregate_filter(self) -> None:
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                **self.payload(filterQuery="gen_ai.tool.name:search OR conversation.errors:>0"),
                status_code=201,
            )

        assert response.data["filterQuery"] == "gen_ai.tool.name:search OR conversation.errors:>0"

    def test_rejects_invalid_filter_query(self) -> None:
        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug,
                **self.payload(filterQuery="(gen_ai.agent.name:support"),
                status_code=400,
            )

        assert "filterQuery" in response.data
        assert not TelemetryClassifier.objects.exists()

    def test_rejects_project_in_other_organization(self) -> None:
        other_project = self.create_project(organization=self.create_organization())

        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug, **self.payload(project=other_project.id), status_code=400
            )

        assert response.data["project"] == ["Invalid project"]
        assert not TelemetryClassifier.objects.exists()

    def test_member_can_create(self) -> None:
        member = self.create_user()
        self.create_member(
            organization=self.organization, user=member, role="member", teams=[self.team]
        )
        self.login_as(member)

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug, **self.payload(), status_code=201
            )

        assert response.data["createdBy"]["id"] == str(member.id)

    def test_requires_project_access(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        # Build the payload first: the lazy team fixture adds every existing member to the team.
        payload = self.payload()
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[])
        self.login_as(member)

        with self.feature(self.features):
            response = self.get_error_response(self.organization.slug, **payload, status_code=400)

        assert response.data["project"] == ["Insufficient access to project"]
        assert not TelemetryClassifier.objects.exists()

    def test_team_admin_can_create(self) -> None:
        team_admin = self.create_user()
        self.create_member(
            organization=self.organization,
            user=team_admin,
            role="member",
            team_roles=[(self.team, "admin")],
        )
        self.login_as(team_admin)

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug, **self.payload(), status_code=201
            )

        assert response.data["createdBy"]["id"] == str(team_admin.id)
