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
            result_attribute="frustration",
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
            "resultAttribute": "frustration",
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


@cell_silo_test
class OrganizationTelemetryClassifierDetailsPutTest(APITestCase):
    endpoint = "sentry-api-0-organization-telemetry-classifier-details"
    method = "put"
    features = {"organizations:classifiers-ui": True}

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.classifier = self.create_telemetry_classifier(
            name="Refusals",
            result_attribute="refusal",
            prebuilt_classifier_key="refusal",
            natural_language_prompt=None,
            compiled_prompt=None,
            output_type=None,
            created_by_id=self.user.id,
        )

    def test_requires_feature(self) -> None:
        self.get_error_response(
            self.organization.slug, self.classifier.id, status="disabled", status_code=404
        )

        self.classifier.refresh_from_db()
        assert self.classifier.status == "enabled"

    def test_disables_and_enables(self) -> None:
        date_updated = self.classifier.date_updated

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug, self.classifier.id, status="disabled"
            )

            self.classifier.refresh_from_db()
            assert self.classifier.status == "disabled"
            assert self.classifier.date_updated > date_updated
            assert self.classifier.created_by_id == self.user.id
            assert response.data.pop("createdBy")["id"] == str(self.user.id)
            assert response.data == {
                "id": str(self.classifier.id),
                "projectId": str(self.project.id),
                "name": "Refusals",
                "resultAttribute": "refusal",
                "dataset": "conversation",
                "filterQuery": "",
                "status": "disabled",
                "prebuiltClassifierKey": "refusal",
                "naturalLanguagePrompt": None,
                "outputType": None,
                "dateAdded": self.classifier.date_added,
                "dateUpdated": self.classifier.date_updated,
            }

            response = self.get_success_response(
                self.organization.slug, self.classifier.id, status="enabled"
            )

        assert response.data["status"] == "enabled"
        self.classifier.refresh_from_db()
        assert self.classifier.status == "enabled"

    def test_requires_valid_status(self) -> None:
        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug, self.classifier.id, status_code=400
            )
            assert "status" in response.data

            response = self.get_error_response(
                self.organization.slug, self.classifier.id, status="paused", status_code=400
            )
            assert "status" in response.data

    def test_rejects_other_fields(self) -> None:
        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug,
                self.classifier.id,
                status="disabled",
                name="Renamed",
                status_code=400,
            )

        assert response.data["nonFieldErrors"] == ["Only status can be updated."]
        self.classifier.refresh_from_db()
        assert self.classifier.name == "Refusals"
        assert self.classifier.status == "enabled"

    def test_member_can_update(self) -> None:
        member = self.create_user()
        self.create_member(
            organization=self.organization, user=member, role="member", teams=[self.team]
        )
        self.login_as(member)

        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug, self.classifier.id, status="disabled"
            )

        assert response.data["status"] == "disabled"
        self.classifier.refresh_from_db()
        assert self.classifier.status == "disabled"

    def test_team_admin_can_update(self) -> None:
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
                self.organization.slug, self.classifier.id, status="disabled"
            )

        assert response.data["status"] == "disabled"
        assert response.data["createdBy"]["id"] == str(self.user.id)

    def test_classifier_on_inaccessible_project(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[])
        self.login_as(member)

        with self.feature(self.features):
            self.get_error_response(
                self.organization.slug, self.classifier.id, status="disabled", status_code=404
            )
