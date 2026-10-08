from uuid import uuid4

from django.urls import reverse

from sentry.api.endpoints.organization_trace_item_attributes_merged import (
    MergedTraceItemAttribute,
    merge_attributes_across_datasets,
    sort_merged_attributes,
)
from sentry.search.eap.types import ColumnType
from sentry.testutils.cases import (
    APITestCase,
    BaseSpansTestCase,
    OurLogTestCase,
    SpanTestCase,
)
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now


class TestMergeAttributesAcrossDatasets:
    def test_merges_matching_attributes_into_one_row(self) -> None:
        merged = merge_attributes_across_datasets(
            {
                "spans": [
                    {
                        "key": "cart.id",
                        "name": "cart.id",
                        "attributeType": "string",
                        "attributeSource": {"source_type": "user"},
                        "context": {},
                    }
                ],
                "logs": [
                    {
                        "key": "cart.id",
                        "name": "cart.id",
                        "attributeType": "string",
                        "attributeSource": {"source_type": "user"},
                        "context": {"isCustom": True, "brief": "The cart"},
                    }
                ],
            }
        )

        assert merged == [
            {
                "name": "cart.id",
                "attributeType": "string",
                "attributeSource": {"source_type": "user"},
                "datasets": ["spans", "logs"],
                "context": {"isCustom": True, "brief": "The cart"},
            }
        ]

    def test_keeps_separate_rows_when_types_or_sources_differ(self) -> None:
        merged = merge_attributes_across_datasets(
            {
                "spans": [
                    {
                        "key": "cache.hit",
                        "name": "cache.hit",
                        "attributeType": "boolean",
                        "attributeSource": {"source_type": "sentry"},
                    },
                    {
                        "key": "tags[cache.hit,boolean]",
                        "name": "cache.hit",
                        "attributeType": "boolean",
                        "attributeSource": {"source_type": "user"},
                    },
                    {
                        "key": "tags[cache.hit,number]",
                        "name": "cache.hit",
                        "attributeType": "number",
                        "attributeSource": {"source_type": "user"},
                    },
                ],
            }
        )

        assert merged == [
            {
                "name": "cache.hit",
                "attributeType": "boolean",
                "attributeSource": {"source_type": "sentry"},
                "datasets": ["spans"],
            },
            {
                "name": "cache.hit",
                "attributeType": "boolean",
                "attributeSource": {"source_type": "user"},
                "datasets": ["spans"],
            },
            {
                "name": "cache.hit",
                "attributeType": "number",
                "attributeSource": {"source_type": "user"},
                "datasets": ["spans"],
            },
        ]


def _merged_attribute(
    name: str, attribute_type: ColumnType, datasets: list[str], brief: str | None = None
) -> MergedTraceItemAttribute:
    attribute: MergedTraceItemAttribute = {
        "name": name,
        "attributeType": attribute_type,
        "attributeSource": {"source_type": "user"},
        "datasets": datasets,
        "context": {},
    }
    if brief is not None:
        attribute["context"] = {"brief": brief}
    return attribute


class TestSortMergedAttributes:
    attributes = [
        _merged_attribute("beta", "string", ["logs"], brief="Second"),
        _merged_attribute("alpha", "number", ["spans", "logs"]),
        _merged_attribute("gamma", "boolean", ["spans"], brief="first"),
    ]

    def test_sorts_by_name_when_sort_is_name(self) -> None:
        sorted_attributes = sort_merged_attributes(self.attributes, "name")

        assert [attribute["name"] for attribute in sorted_attributes] == [
            "alpha",
            "beta",
            "gamma",
        ]

    def test_sorts_descending_when_sort_is_prefixed(self) -> None:
        sorted_attributes = sort_merged_attributes(self.attributes, "-name")

        assert [attribute["name"] for attribute in sorted_attributes] == [
            "gamma",
            "beta",
            "alpha",
        ]

    def test_sorts_by_type_when_sort_is_type(self) -> None:
        sorted_attributes = sort_merged_attributes(self.attributes, "type")

        assert [attribute["attributeType"] for attribute in sorted_attributes] == [
            "boolean",
            "number",
            "string",
        ]

    def test_sorts_by_dataset_order_when_sort_is_datasets(self) -> None:
        sorted_attributes = sort_merged_attributes(self.attributes, "datasets")

        assert [attribute["name"] for attribute in sorted_attributes] == [
            "gamma",
            "alpha",
            "beta",
        ]

    def test_sorts_missing_descriptions_last_when_sort_is_description(self) -> None:
        sorted_attributes = sort_merged_attributes(self.attributes, "description")

        assert [attribute["name"] for attribute in sorted_attributes] == [
            "gamma",
            "beta",
            "alpha",
        ]

    def test_sorts_missing_descriptions_last_when_sort_is_descending_description(self) -> None:
        sorted_attributes = sort_merged_attributes(self.attributes, "-description")

        assert [attribute["name"] for attribute in sorted_attributes] == [
            "beta",
            "gamma",
            "alpha",
        ]


class OrganizationTraceItemAttributesMergedEndpointTest(
    BaseSpansTestCase, SpanTestCase, OurLogTestCase, APITestCase
):
    viewname = "sentry-api-0-organization-trace-item-attributes-merged"
    feature_flags = {
        "organizations:attribute-management": True,
        "organizations:ourlogs-enabled": True,
        "organizations:visibility-explore-view": True,
    }

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def do_request(self, query=None, features=None):
        with self.feature(self.feature_flags if features is None else features):
            url = reverse(
                self.viewname,
                kwargs={"organization_id_or_slug": self.organization.slug},
            )
            return self.client.get(
                url, {"project": self.project.id, **(query or {})}, format="json"
            )

    def _store_span_and_log(self) -> None:
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            organization_id=self.organization.id,
            timestamp=before_now(minutes=10).replace(microsecond=0),
            tags={"shared.attribute": "span", "span.only": "span"},
        )
        self.store_eap_items(
            [
                self.create_ourlog(
                    organization=self.organization,
                    project=self.project,
                    attributes={
                        "shared.attribute": {"string_value": "log"},
                        "log.only": {"string_value": "log"},
                    },
                )
            ]
        )

    def _custom_attributes(self, response) -> dict[str, dict]:
        return {
            attribute["name"]: attribute
            for attribute in response.data
            if attribute["name"] in {"shared.attribute", "span.only", "log.only"}
        }

    def test_returns_404_when_attribute_management_is_disabled(self) -> None:
        response = self.do_request(
            features={
                "organizations:ourlogs-enabled": True,
                "organizations:visibility-explore-view": True,
            }
        )

        assert response.status_code == 404, response.content

    def test_lists_each_attribute_with_the_datasets_it_appears_in(self) -> None:
        self._store_span_and_log()

        response = self.do_request(query={"attributeType": "string"})

        assert response.status_code == 200, response.content
        attributes = self._custom_attributes(response)
        assert attributes["shared.attribute"]["datasets"] == ["spans", "logs"]
        assert attributes["span.only"]["datasets"] == ["spans"]
        assert attributes["log.only"]["datasets"] == ["logs"]
        assert attributes["shared.attribute"]["attributeSource"] == {"source_type": "user"}

    def test_restricts_results_when_datasets_are_provided(self) -> None:
        self._store_span_and_log()

        response = self.do_request(query={"attributeType": "string", "dataset": "logs"})

        assert response.status_code == 200, response.content
        attributes = self._custom_attributes(response)
        assert set(attributes) == {"shared.attribute", "log.only"}
        assert all(attribute["datasets"] == ["logs"] for attribute in response.data)

    def test_includes_context_when_expanded(self) -> None:
        self._store_span_and_log()

        response = self.do_request(query={"attributeType": "string", "expand": "context"})

        assert response.status_code == 200, response.content
        attributes = {attribute["name"]: attribute for attribute in response.data}
        assert attributes["shared.attribute"]["context"] == {}
        assert attributes["project"]["context"]["brief"]

    def test_includes_internal_convention_attributes_when_user_is_staff(self) -> None:
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            organization_id=self.organization.id,
            timestamp=before_now(minutes=10).replace(microsecond=0),
            tags={"dsc.trace_id": "internal"},
        )
        user = self.create_user(is_staff=True)
        self.create_member(user=user, organization=self.organization, teams=[self.team])
        self.login_as(user=user)

        response = self.do_request(query={"attributeType": "string"})

        assert response.status_code == 200, response.content
        assert "dsc.trace_id" in {attribute["name"] for attribute in response.data}

    def test_hides_internal_convention_attributes_when_user_is_not_staff(self) -> None:
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            organization_id=self.organization.id,
            timestamp=before_now(minutes=10).replace(microsecond=0),
            tags={"dsc.trace_id": "internal"},
        )
        user = self.create_user()
        self.create_member(user=user, organization=self.organization, teams=[self.team])
        self.login_as(user=user)

        response = self.do_request(query={"attributeType": "string"})

        assert response.status_code == 200, response.content
        assert "dsc.trace_id" not in {attribute["name"] for attribute in response.data}

    def test_paginates_merged_results_when_per_page_is_provided(self) -> None:
        self._store_span_and_log()

        first_page = self.do_request(query={"attributeType": "string", "per_page": 2})
        links = {
            attrs["rel"]: {**attrs, "href": url}
            for url, attrs in parse_link_header(first_page["Link"]).items()
        }
        second_page = self.do_request(
            query={"attributeType": "string", "per_page": 2, "cursor": links["next"]["cursor"]}
        )

        assert first_page.status_code == 200, first_page.content
        assert len(first_page.data) == 2
        assert int(first_page["X-Hits"]) == int(second_page["X-Hits"]) > 2
        assert links["next"]["results"] == "true"
        assert second_page.status_code == 200, second_page.content
        assert {attribute["name"] for attribute in first_page.data}.isdisjoint(
            attribute["name"] for attribute in second_page.data
        )

    def test_sorts_results_when_sort_is_provided(self) -> None:
        self._store_span_and_log()

        response = self.do_request(query={"attributeType": "string", "sort": "-name"})

        assert response.status_code == 200, response.content
        names = [attribute["name"] for attribute in response.data]
        assert names == sorted(names, reverse=True)

    def test_sorts_by_description_when_context_is_not_expanded(self) -> None:
        self._store_span_and_log()

        expanded = self.do_request(
            query={"attributeType": "string", "sort": "description", "expand": "context"}
        )
        response = self.do_request(query={"attributeType": "string", "sort": "description"})

        assert response.status_code == 200, response.content
        assert [attribute["name"] for attribute in response.data] == [
            attribute["name"] for attribute in expanded.data
        ]
        assert [attribute["name"] for attribute in response.data] != sorted(
            attribute["name"] for attribute in response.data
        )
        assert all("context" not in attribute for attribute in response.data)

    def test_returns_zero_hits_when_there_are_no_projects(self) -> None:
        organization = self.create_organization(owner=self.user)

        with self.feature(self.feature_flags):
            response = self.client.get(
                reverse(self.viewname, kwargs={"organization_id_or_slug": organization.slug}),
                format="json",
            )

        assert response.status_code == 200, response.content
        assert response.data == []
        assert response["X-Hits"] == "0"

    def test_returns_400_when_sort_is_invalid(self) -> None:
        response = self.do_request(query={"sort": "unknown"})

        assert response.status_code == 400, response.content
