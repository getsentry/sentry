from unittest import mock

import pytest
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeNamesRequest,
    TraceItemAttributeNamesResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap import utils
from sentry.search.eap.constants import SearchType
from sentry.search.eap.utils import (
    attribute_name_exists,
    check_attribute_names_exist,
    parse_formula,
    serialize_search_type,
)
from sentry.testutils.cases import TestCase


@pytest.mark.parametrize(
    ("search_type", "expected"),
    [
        ("string", "string"),
        ("boolean", "boolean"),
        ("array", "array"),
        ("integer", "number"),
        ("duration", "number"),
    ],
)
def test_serialize_search_type_maps_to_the_public_type_name(
    search_type: SearchType, expected: str
) -> None:
    assert serialize_search_type(search_type) == expected


def test_attribute_name_exists_gives_up_past_the_page_bound() -> None:
    page_limit = 5
    # Every decoy contains the target name, so the substring match cannot narrow them away,
    # and the target sorts last: it only appears on the fourth page, past the bound.
    names = sorted({f"a_{index:03}_my_tag" for index in range(19)} | {"my_tag"})
    offsets = []

    def attribute_names_rpc(
        request: TraceItemAttributeNamesRequest,
    ) -> TraceItemAttributeNamesResponse:
        offsets.append(request.page_token.offset)
        page = names[request.page_token.offset :][: request.limit]
        return TraceItemAttributeNamesResponse(
            attributes=[
                TraceItemAttributeNamesResponse.Attribute(name=name, type=request.type)
                for name in page
            ]
        )

    with (
        mock.patch.object(utils, "ATTRIBUTE_NAME_LIMIT", page_limit),
        mock.patch("sentry.search.eap.utils.snuba_rpc.attribute_names_rpc", attribute_names_rpc),
    ):
        found = attribute_name_exists(RequestMeta(), AttributeKey.TYPE_STRING, "my_tag")

    assert not found
    assert offsets == [0, page_limit, page_limit * 2]


def test_check_attribute_names_exist_gives_up_past_the_page_bound() -> None:
    page_limit = 5
    # Every page comes back full of names nobody asked about, so paging never narrows
    # and never runs out: only the page bound stops it.
    decoys = [f"a_{index:03}" for index in range(100)]
    offsets = []

    def attribute_names_rpc(
        request: TraceItemAttributeNamesRequest,
    ) -> TraceItemAttributeNamesResponse:
        offsets.append(request.page_token.offset)
        page = decoys[request.page_token.offset :][: request.limit]
        return TraceItemAttributeNamesResponse(
            attributes=[
                TraceItemAttributeNamesResponse.Attribute(name=name, type=request.type)
                for name in page
            ]
        )

    with (
        mock.patch.object(utils, "ATTRIBUTE_NAME_LIMIT", page_limit),
        mock.patch("sentry.search.eap.utils.snuba_rpc.attribute_names_rpc", attribute_names_rpc),
    ):
        found = check_attribute_names_exist(RequestMeta(), {AttributeKey.TYPE_STRING: ["my_tag"]})

    assert found == set()
    assert offsets == [0, page_limit, page_limit * 2]


class TestParseFormula(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.formula = self.create_explore_saved_formula(organization=self.org)

    def test_parse_formula_wrong_args(self) -> None:
        with pytest.raises(InvalidSearchQuery, match="formula.apdex expected 2 arguments got 5"):
            parse_formula("formula.apdex(span.duration, 300, 300, 300, 300)", self.org)

    def test_parse_formula_wrong_arg_type(self) -> None:
        with pytest.raises(
            InvalidSearchQuery, match="threshold expected a number but got 'hello_world' instead"
        ):
            parse_formula("formula.apdex(span.duration, hello_world)", self.org)

    def test_parse_formula_simple(self) -> None:
        equation = parse_formula("formula.apdex(span.duration, 300)", self.org)
        assert (
            equation
            == "equation|(count_if(`span.duration:<300.0`) + count_if(`span.duration:>=300.0 and span.duration:<=1200.0`) / 2) / count()"
        )

        equation = parse_formula("formula.apdex(measurements.lcp, 400)", self.org)
        assert (
            equation
            == "equation|(count_if(`measurements.lcp:<400.0`) + count_if(`measurements.lcp:>=400.0 and measurements.lcp:<=1600.0`) / 2) / count()"
        )
