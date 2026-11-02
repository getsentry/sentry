from typing import Any

from django.test import override_settings
from django.urls import reverse

from sentry.api.endpoints.organization_explore_formulas import sync_prebuilt_formulas
from sentry.explore.models import (
    ExploreSavedFormula,
    KindItemTypes,
    ParamItemTypes,
)
from sentry.models.organization import Organization
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import Factories
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context


class BaseFormulaTest(APITestCase):
    feature_flags = {
        "organizations:explore-saved-formulas": True,
    }

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.formula_object = Factories.explore_apdex_formula_data()

    def create_formula(
        self, data: dict[Any, Any] | None = None, organization: None | Organization = None
    ) -> ExploreSavedFormula:
        return self.create_explore_saved_formula(
            organization=self.org if organization is None else organization,
            data=self.formula_object if data is None else data,
        )


class TestFormulaDetails(BaseFormulaTest):
    def test_get_explore_formula(self) -> None:
        formula = self.create_formula()
        with self.feature(self.feature_flags):
            response = self.client.get(
                reverse("sentry-api-0-explore-formulas-detail", args=[self.org.slug, formula.id])
            )
            assert response.status_code == 200, response.content

        data = response.data
        assert data["id"] == str(formula.id)
        assert data["name"] == "formula.custom_apdex"
        assert data["dataset"] == "spans"
        assert data["description"] == "A custom version of apdex for testing"
        assert data["formula"] == "({count_satisfied} + {count_tolerating} / 2) / count()"
        assert data["unit"] is None
        assert data["type"] == "number"
        assert not data["prebuilt"]
        assert data["references"] == [
            {"name": "count_satisfied", "value": "count_if(`{duration}:<{threshold}`)"},
            {
                "name": "count_tolerating",
                "value": "count_if(`{duration}:>={threshold} and {duration}:<={frustrated}`)",
            },
        ]
        assert data["params"] == [
            {
                "name": "duration",
                "type": "column",
                "order": 0,
                "value": "",
            },
            {
                "name": "threshold",
                "type": "number",
                "order": 1,
                "value": "",
            },
            {"name": "frustrated", "type": "calculation", "order": 2, "value": "{threshold} * 4"},
        ]

    def test_get_out_of_range_id(self) -> None:
        with self.feature(self.feature_flags):
            response = self.client.get(
                reverse(
                    "sentry-api-0-explore-formulas-detail",
                    args=[self.org.slug, "99999999999999999999"],
                )
            )
        assert response.status_code == 404

    def test_delete_explore_formula(self) -> None:
        formula = self.create_formula()
        with self.feature(self.feature_flags):
            response = self.client.delete(
                reverse("sentry-api-0-explore-formulas-detail", args=[self.org.slug, formula.id])
            )
            assert response.status_code == 204, response.content
        assert ExploreSavedFormula.objects.filter(id=formula.id).first() is None

    def test_delete_explore_prebuilt(self) -> None:
        sync_prebuilt_formulas(self.org)
        prebuilt = ExploreSavedFormula.objects.filter(prebuilt_id=1).first()
        assert prebuilt is not None
        with self.feature(self.feature_flags):
            response = self.client.delete(
                reverse("sentry-api-0-explore-formulas-detail", args=[self.org.slug, prebuilt.id])
            )
            assert response.status_code == 204, response.content
            response = self.client.get(
                reverse("sentry-api-0-explore-formulas", args=[self.org.slug])
            )
            assert response.status_code == 200, response.content
            formula_names = [row["name"] for row in response.data]
            assert prebuilt.name not in formula_names
        prebuilt.refresh_from_db()
        assert prebuilt.prebuilt_deleted

    def test_update_explore_formula(self) -> None:
        formula = self.create_formula()
        self.formula_object["name"] = "formula.hello"
        self.formula_object["formula"] = "count() + count()"
        self.formula_object["description"] = "test description"
        self.formula_object["dataset"] = "logs"
        with self.feature(self.feature_flags):
            response = self.client.put(
                reverse("sentry-api-0-explore-formulas-detail", args=[self.org.slug, formula.id]),
                data=self.formula_object,
            )
            assert response.status_code == 200, response.content
        assert response.data["name"] == "formula.hello"
        assert response.data["updatedBy"]["email"] == self.user.email
        assert response.data["formula"] == "count() + count()"
        assert response.data["description"] == "test description"
        assert response.data["dataset"] == "logs"

    @override_settings(SEER_API_SHARED_SECRET="service-account-secret")
    def test_update_explore_formula_as_service_account(self) -> None:
        formula = self.create_formula()
        formula.update(created_by_id=self.user.id, updated_by_id=self.user.id)
        service_account = self.create_service_account(
            organization=self.org, scope_list=["org:read", "org:write"]
        )
        viewer_context = encode_viewer_context(
            ViewerContext(
                actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=service_account.id),
                organization_id=self.org.id,
            ),
            key="service-account-secret",
        )
        self.formula_object["name"] = "formula.by_service_account"
        with self.feature({**self.feature_flags, "organizations:service-accounts": True}):
            response = self.client.put(
                reverse("sentry-api-0-explore-formulas-detail", args=[self.org.slug, formula.id]),
                data=self.formula_object,
                HTTP_X_VIEWER_CONTEXT=viewer_context,
            )
        assert response.status_code == 200, response.content
        assert response.data["createdBy"]["email"] == self.user.email
        assert response.data["updatedBy"] is None

    def test_too_many_input_parameters(self) -> None:
        formula = self.create_formula()
        self.formula_object["name"] = "formula.hello"
        self.formula_object["formula"] = "count() + count()"
        self.formula_object["description"] = "test description"
        self.formula_object["dataset"] = "logs"
        self.formula_object["params"].append(
            {
                "name": "extra",
                "value": "test",
                "type": "column",
                "order": 3,
            }
        )
        with self.feature(self.feature_flags):
            response = self.client.put(
                reverse("sentry-api-0-explore-formulas-detail", args=[self.org.slug, formula.id]),
                data=self.formula_object,
            )
            assert response.status_code == 400, response.content
        assert "params" in response.data
        assert "number or column parameters per formula" in str(response.data["params"][0])

    def test_too_many_params(self) -> None:
        formula = self.create_formula()
        self.formula_object["name"] = "formula.hello"
        self.formula_object["formula"] = "count() + count()"
        self.formula_object["description"] = "test description"
        self.formula_object["dataset"] = "logs"
        for i in range(3, 8):
            self.formula_object["params"].append(
                {
                    "name": f"extra{i}",
                    "value": "test",
                    "type": "calculation",
                    "order": i,
                }
            )
        with self.feature(self.feature_flags):
            response = self.client.put(
                reverse("sentry-api-0-explore-formulas-detail", args=[self.org.slug, formula.id]),
                data=self.formula_object,
            )
            assert response.status_code == 400, response.content
        assert "params" in response.data
        assert "number or column parameters per formula" not in str(response.data["params"][0])
        assert "parameters per formula" in str(response.data["params"][0])

    def test_too_many_references(self) -> None:
        formula = self.create_formula()
        self.formula_object["name"] = "formula.hello"
        self.formula_object["formula"] = "count() + count()"
        self.formula_object["description"] = "test description"
        self.formula_object["dataset"] = "logs"
        for i in range(3, 8):
            self.formula_object["references"].append(
                {
                    "name": f"extra{i}",
                    "value": "test",
                }
            )
        with self.feature(self.feature_flags):
            response = self.client.put(
                reverse("sentry-api-0-explore-formulas-detail", args=[self.org.slug, formula.id]),
                data=self.formula_object,
            )
            assert response.status_code == 400, response.content
        assert "references" in response.data
        assert "references per formula" in str(response.data["references"][0])

    def test_update_explore_formula_with_name_already_in_db(self) -> None:
        formula = self.create_formula()
        formula_object2 = self.formula_object.copy()
        formula_object2["name"] = "formula.hello"
        # Create a formula with the name we'll put with
        self.create_formula(formula_object2)
        with self.feature(self.feature_flags):
            response = self.client.put(
                # update the first formula with the second one
                reverse("sentry-api-0-explore-formulas-detail", args=[self.org.slug, formula.id]),
                data=formula_object2,
            )
            assert response.status_code == 400, response.content
        assert str(response.data["detail"]) == "Formula name must be unique"

    def test_update_explore_formula_with_invalid_param_default(self) -> None:
        formula = self.create_formula()
        self.formula_object["params"][1]["value"] = "foobar"
        with self.feature(self.feature_flags):
            response = self.client.put(
                reverse("sentry-api-0-explore-formulas-detail", args=[self.org.slug, formula.id]),
                data=self.formula_object,
            )
            assert response.status_code == 400, response.content
        assert (
            str(response.data["params"]["value"][0])
            == "'foobar' is an invalid value for a numeric default"
        )


class TestFormulas(BaseFormulaTest):
    def setUp(self) -> None:
        super().setUp()
        self.url = reverse("sentry-api-0-explore-formulas", args=[self.org.slug])

    def test_member_can_create_and_edit_any_formula(self) -> None:
        self.org.flags.allow_joinleave = False
        self.org.save()
        existing = self.create_formula()
        member = self.create_user()
        self.create_member(user=member, organization=self.org, role="member")
        self.login_as(member)

        created = self.formula_object.copy()
        created["name"] = "formula.member_created"
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=created,
            )
            assert response.status_code == 201, response.content

        updated = self.formula_object.copy()
        updated["name"] = "formula.member_edit"
        updated["formula"] = "count() + count()"
        with self.feature(self.feature_flags):
            response = self.client.put(
                reverse("sentry-api-0-explore-formulas-detail", args=[self.org.slug, existing.id]),
                data=updated,
            )
            assert response.status_code == 200, response.content
        assert response.data["name"] == "formula.member_edit"

    def test_no_feature_flags(self) -> None:
        response = self.client.post(
            self.url,
            data={},
        )
        assert response.status_code == 404, response.content
        response = self.client.get(
            self.url,
        )
        assert response.status_code == 404, response.content

    def test_create_explore_formula_rejects_long_variable_value(self) -> None:
        data = self.formula_object.copy()
        data["params"] = [
            {
                "name": "duration",
                "type": "column",
                "order": 0,
                "value": "x" * 201,
            }
        ]
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=data,
            )
            assert response.status_code == 400, response.content
        assert "params" in response.data
        assert "200 characters" in str(response.data["params"]["value"][0])

    def test_create_explore_formula_rejects_calculations_on_columns(self) -> None:
        data = self.formula_object.copy()
        data["params"].append(
            {
                "name": "calc_column",
                "type": "calculation",
                "order": 0,
                "value": "{duration} * 4",
            }
        )
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=data,
            )
            assert response.status_code == 400, response.content
        assert "non_field_errors" in response.data
        assert "Columns cannot be used in calculations" in str(response.data["non_field_errors"][0])

    def test_calculation_without_value(self) -> None:
        self.formula_object["params"].append(
            {
                "name": "nothreshold",
                "type": "calculation",
                "order": 3,
                "value": "",
            }
        )
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=self.formula_object,
            )
            assert response.status_code == 400, response.content
        assert "params" in response.data
        assert "value" in response.data["params"]
        assert "Calculations must have a value" in str(response.data["params"]["value"][0])

    def test_reference_without_value(self) -> None:
        self.formula_object["references"].append(
            {
                "name": "noreference",
                "value": "",
            }
        )
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=self.formula_object,
            )
            assert response.status_code == 400, response.content
        assert "references" in response.data
        assert "value" in response.data["references"]
        assert "References must have a value" in str(response.data["references"]["value"][0])

    def test_empty_reference(self) -> None:
        """As in the value is just {}, so it still has a value but its not representing anything"""
        self.formula_object["references"].append(
            {
                "name": "noreference",
                "value": "{}",
            }
        )
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=self.formula_object,
            )
            assert response.status_code == 400, response.content
        assert "non_field_errors" in response.data
        assert "Formula either has empty format strings" in str(
            response.data["non_field_errors"][0]
        )

    def test_formula_without_value(self) -> None:
        self.formula_object["formula"] = ""
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=self.formula_object,
            )
            assert response.status_code == 400, response.content
        assert "formula" in response.data
        assert "This field may not be blank" in str(response.data["formula"][0])

    def test_formula_validation(self) -> None:
        self.formula_object["formula"] = "{count_satisfied} + + {count_satisfied}"
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=self.formula_object,
            )
            assert response.status_code == 400, response.content
        assert "non_field_errors" in response.data
        assert "Unable to parse your equation" in str(response.data["non_field_errors"][0])

    def test_calculation_validation(self) -> None:
        self.formula_object["params"][2]["value"] = "{prossh} * 5"
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=self.formula_object,
            )
            assert response.status_code == 400, response.content
        assert "non_field_errors" in response.data
        error_msg = str(response.data["non_field_errors"][0])
        assert "Missing parameters for frustrated; prossh" == error_msg

    def test_parameter_existence_validation(self) -> None:
        self.formula_object["formula"] = "count_if(`{duration}:<{prossh} or {2.threshold}`)"
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=self.formula_object,
            )
            assert response.status_code == 400, response.content
        assert "non_field_errors" in response.data
        error_msg = str(response.data["non_field_errors"][0])
        assert "Missing parameters for formula; prossh, 2.threshold" in error_msg

    def test_create_explore_formula_without_unit(self) -> None:
        data = self.formula_object.copy()
        del data["unit"]
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=data,
            )
            assert response.status_code == 201, response.content
        formula = ExploreSavedFormula.objects.get(id=response.data["id"])
        assert formula.unit is None

    def test_create_explore_formula_with_invalid_dataset(self) -> None:
        data = self.formula_object.copy()
        data["dataset"] = "flooded strand"
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=data,
            )
            assert response.status_code == 400, response.content
        assert "dataset" in response.data
        assert "is not a valid choice" in str(response.data["dataset"][0])

    def test_create_explore_formula_without_formula_prefix(self) -> None:
        data = self.formula_object
        data["name"] = "hello"
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=data,
            )
            assert response.status_code == 400, response.content
        assert "name" in response.data
        assert str(response.data["name"][0]) == "Formula names must begin with `formula`"

    def test_create_formula_with_overlapping_name(self) -> None:
        data = self.formula_object
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=data,
            )
            assert response.status_code == 201, response.content
        data = self.formula_object
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=data,
            )
            assert response.status_code == 400, response.content
        assert str(response.data["detail"]) == "Formula name must be unique"

    def test_create_explore_formula(self) -> None:
        data = self.formula_object
        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=data,
            )
            assert response.status_code == 201, response.content
        formula_id = response.data["id"]
        formula = ExploreSavedFormula.objects.get(id=formula_id)
        assert formula.name == data["name"]
        assert formula.formula == data["formula"]
        assert formula.unit is None
        references = formula.variables.filter(kind=KindItemTypes.REFERENCE).order_by("name")
        assert len(references) == 2
        assert references[0].name == data["references"][0]["name"]
        assert references[0].value == data["references"][0]["value"]
        assert references[1].name == data["references"][1]["name"]
        assert references[1].value == data["references"][1]["value"]
        params = formula.variables.filter(kind=KindItemTypes.PARAM).order_by("order")
        assert len(params) == 3
        assert params[0].name == data["params"][0]["name"]
        assert ParamItemTypes.get_type_name(params[0].param_type) == data["params"][0]["type"]
        assert params[0].order == data["params"][0]["order"]
        assert params[0].value == data["params"][0]["value"]
        assert params[1].name == data["params"][1]["name"]
        assert ParamItemTypes.get_type_name(params[1].param_type) == data["params"][1]["type"]
        assert params[1].order == data["params"][1]["order"]
        assert params[1].value == data["params"][1]["value"]
        assert params[2].name == data["params"][2]["name"]
        assert ParamItemTypes.get_type_name(params[2].param_type) == data["params"][2]["type"]
        assert params[2].order == data["params"][2]["order"]
        assert params[2].value == data["params"][2]["value"]

    def test_create_explore_formula_with_upper_case(self) -> None:
        upper_data = self.formula_object.copy()
        data = self.formula_object.copy()
        for key, value in upper_data.items():
            if isinstance(value, str) and key != "dataset":
                upper_data[key] = value.upper()
            elif isinstance(value, dict):
                for sub_key, sub_value in value.items():
                    if isinstance(sub_value, str):
                        upper_data[key][sub_key] = sub_value.upper()

        with self.feature(self.feature_flags):
            response = self.client.post(
                self.url,
                data=upper_data,
            )
            assert response.status_code == 201, response.content
        formula_id = response.data["id"]
        formula = ExploreSavedFormula.objects.get(id=formula_id)
        assert formula.name == data["name"]
        assert formula.formula == data["formula"]
        assert formula.unit is None
        references = formula.variables.filter(kind=KindItemTypes.REFERENCE).order_by("name")
        assert len(references) == 2
        assert references[0].name == data["references"][0]["name"]
        assert references[0].value == data["references"][0]["value"]
        assert references[1].name == data["references"][1]["name"]
        assert references[1].value == data["references"][1]["value"]
        params = formula.variables.filter(kind=KindItemTypes.PARAM).order_by("order")
        assert len(params) == 3
        assert params[0].name == data["params"][0]["name"]
        assert ParamItemTypes.get_type_name(params[0].param_type) == data["params"][0]["type"]
        assert params[0].order == data["params"][0]["order"]
        assert params[0].value == data["params"][0]["value"]
        assert params[1].name == data["params"][1]["name"]
        assert ParamItemTypes.get_type_name(params[1].param_type) == data["params"][1]["type"]
        assert params[1].order == data["params"][1]["order"]
        assert params[1].value == data["params"][1]["value"]
        assert params[2].name == data["params"][2]["name"]
        assert ParamItemTypes.get_type_name(params[2].param_type) == data["params"][2]["type"]
        assert params[2].order == data["params"][2]["order"]
        assert params[2].value == data["params"][2]["value"]

    def test_list_explore_formulas(self) -> None:
        for i in range(5):
            self.formula_object["name"] = f"formula.apdex{i}"
            self.create_formula(self.formula_object)
        with self.feature(self.feature_flags):
            response = self.client.get(
                self.url,
            )
            assert response.status_code == 200, response.content
        assert len(response.data) == 7
        formula_names = [row["name"] for row in response.data]
        for i in range(5):
            assert f"formula.apdex{i}" in formula_names

    def test_list_with_prebuilt(self) -> None:
        for i in range(5):
            self.formula_object["name"] = f"formula.apdex{i}"
            self.create_formula(self.formula_object)
        with self.feature(self.feature_flags):
            response = self.client.get(self.url, data={"prebuilt": "true"})
            assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]["name"] == "formula.apdex"
        assert response.data[1]["name"] == "formula.user_misery"
        assert response.data[0]["params"][0]["value"] == "span.duration"

    def test_list_with_orderby(self) -> None:
        for i in range(5):
            self.formula_object["name"] = f"formula.apdex{i}"
            self.create_formula(self.formula_object)
        with self.feature(self.feature_flags):
            response = self.client.get(self.url, data={"sortBy": "-name", "prebuilt": "false"})
            assert response.status_code == 200, response.content
        assert len(response.data) == 5
        for i in range(5):
            assert response.data[i]["name"] == f"formula.apdex{4 - i}"

    def test_invalid_sort_by(self) -> None:
        with self.feature(self.feature_flags):
            response = self.client.get(self.url, data={"sortBy": "not-a-field"})
        assert response.status_code == 400, response.content
        assert response.data["sortBy"] == ["Invalid sort field"]

    def test_list_with_name_filter(self) -> None:
        for i in range(5):
            if i < 3:
                self.formula_object["name"] = f"formula.apdex{i}"
            else:
                self.formula_object["name"] = f"formula.flub{i}"
            self.create_formula(self.formula_object)
        with self.feature(self.feature_flags):
            response = self.client.get(self.url, data={"name": "apdex", "prebuilt": "false"})
            assert response.status_code == 200, response.content
        assert len(response.data) == 3
        formula_names = [row["name"] for row in response.data]
        for i in range(3):
            assert f"formula.apdex{i}" in formula_names

    def test_list_with_parameter_filter(self) -> None:
        self.formula_object["name"] = "formula.with_duration"
        self.create_formula(self.formula_object)
        self.formula_object["name"] = "formula.no_duration"
        self.formula_object["params"] = [
            {"name": "threshold", "type": "number", "order": 0, "value": ""}
        ]
        self.create_formula(self.formula_object)
        with self.feature(self.feature_flags):
            response = self.client.get(self.url, data={"parameter": "dura", "prebuilt": "false"})
            assert response.status_code == 200, response.content
        assert [row["name"] for row in response.data] == ["formula.with_duration"]

    def test_parameter_filter_is_case_insensitive(self) -> None:
        self.formula_object["name"] = "formula.with_duration"
        self.create_formula(self.formula_object)
        with self.feature(self.feature_flags):
            response = self.client.get(
                self.url, data={"parameter": "Duration", "prebuilt": "false"}
            )
            assert response.status_code == 200, response.content
        assert [row["name"] for row in response.data] == ["formula.with_duration"]

    def test_parameter_filter_ignores_references(self) -> None:
        self.formula_object["name"] = "formula.with_duration"
        self.create_formula(self.formula_object)
        with self.feature(self.feature_flags):
            response = self.client.get(
                self.url, data={"parameter": "count_satisfied", "prebuilt": "false"}
            )
            assert response.status_code == 200, response.content
        assert response.data == []

    def test_list_with_reference_filter(self) -> None:
        self.formula_object["name"] = "formula.with_count"
        self.create_formula(self.formula_object)
        self.formula_object["name"] = "formula.other"
        self.formula_object["references"] = [{"name": "other_ref", "value": "count()"}]
        self.create_formula(self.formula_object)
        with self.feature(self.feature_flags):
            response = self.client.get(
                self.url, data={"reference": "satisfied", "prebuilt": "false"}
            )
            assert response.status_code == 200, response.content
        assert [row["name"] for row in response.data] == ["formula.with_count"]

    def test_reference_filter_returns_each_formula_once(self) -> None:
        self.formula_object["name"] = "formula.with_count"
        self.create_formula(self.formula_object)
        with self.feature(self.feature_flags):
            response = self.client.get(self.url, data={"reference": "count", "prebuilt": "false"})
            assert response.status_code == 200, response.content
        assert [row["name"] for row in response.data] == ["formula.with_count"]

    def test_reference_filter_is_case_insensitive(self) -> None:
        self.formula_object["name"] = "formula.with_count"
        self.create_formula(self.formula_object)
        with self.feature(self.feature_flags):
            response = self.client.get(
                self.url, data={"reference": "Count_Satisfied", "prebuilt": "false"}
            )
            assert response.status_code == 200, response.content
        assert [row["name"] for row in response.data] == ["formula.with_count"]

    def test_reference_filter_ignores_parameters(self) -> None:
        self.formula_object["name"] = "formula.with_count"
        self.create_formula(self.formula_object)
        with self.feature(self.feature_flags):
            response = self.client.get(
                self.url, data={"reference": "duration", "prebuilt": "false"}
            )
            assert response.status_code == 200, response.content
        assert response.data == []

    def test_name_filter_matching_prefix(self) -> None:
        self.formula_object["name"] = "formula.mula"
        self.create_formula(self.formula_object)
        with self.feature(self.feature_flags):
            response = self.client.get(self.url, data={"name": "mula"})
            assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "formula.mula"

    def test_get_prebuilts(self) -> None:
        with self.feature(self.feature_flags):
            response = self.client.get(
                self.url,
            )
            assert response.status_code == 200, response.content
        formula_names = [row["name"] for row in response.data]
        assert "formula.apdex" in formula_names
        assert "formula.user_misery" in formula_names
        assert (
            response.data[0]["description"]
            == "(Application Performance Index) Calculates apdex a weighted average of user experiences"
        )
        assert response.data[0]["createdBy"] is None
        assert response.data[0]["prebuilt"]
        assert response.data[0]["references"][0] == {
            "name": "count_satisfied",
            "value": "count_if(`{duration}:<{threshold}`)",
        }
        assert response.data[0]["params"][0] == {
            "name": "duration",
            "type": "column",
            "order": 0,
            "value": "span.duration",
        }
