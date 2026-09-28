from unittest import mock

import pytest
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeNamesRequest,
    TraceItemAttributeNamesResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.search.eap import utils
from sentry.search.eap.constants import SearchType
from sentry.search.eap.utils import (
    attribute_name_exists,
    check_attribute_names_exist,
    serialize_search_type,
)


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
