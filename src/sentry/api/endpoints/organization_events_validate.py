from collections import defaultdict
from dataclasses import asdict, dataclass
from dataclasses import field as dataclass_field

from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import TraceItemAttributeNamesRequest
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.utils import handle_query_errors
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.search.eap import constants
from sentry.search.eap.columns import ResolvedAttribute
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
from sentry.search.events import fields
from sentry.snuba.referrer import Referrer
from sentry.snuba.utils import RPC_DATASETS
from sentry.utils import snuba_rpc
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor


@dataclass(kw_only=True)
class Validation:
    valid: bool
    error: str | None


@dataclass(kw_only=True)
class AttributeValidation(Validation):
    name: str
    # None when its an error
    attrType: str | None


@dataclass(kw_only=True)
class ValidationResponse:
    valid: bool
    projects: list[Validation] = dataclass_field(default_factory=list)
    dataset: list[Validation] = dataclass_field(default_factory=list)
    field: list[AttributeValidation] = dataclass_field(default_factory=list)
    orderby: list[AttributeValidation] = dataclass_field(default_factory=list)


def serialize_type(search_type: constants.SearchType) -> str:
    proto_type = constants.TYPE_MAP.get(search_type)
    if proto_type == constants.STRING:
        return "string"
    if proto_type == constants.BOOLEAN:
        return "boolean"
    # DOUBLE, INT, or anything else numeric
    return "number"


MAX_ATTRIBUTE_VALIDATION_THREADS = 3


def _check_attributes_by_type(
    meta: RequestMeta,
    attr_type: AttributeKey.Type.ValueType,
    attributes: list[ResolvedAttribute],
) -> set[tuple[AttributeKey.Type.ValueType, str]]:
    """Check which typed attribute names exist in storage for the active window."""
    if not attributes:
        return set()

    requested_names = set(attribute.internal_name for attribute in attributes)
    # TODO(wmak): Need to update snuba here so we can pass the list of attributes, snuba currently does a hasAll if we
    # pass names in a OrFilter which means only rows with _all_ attributes will return
    attrs_request = TraceItemAttributeNamesRequest(
        meta=meta,
        limit=10_000,
        type=attr_type,
    )
    attrs_response = snuba_rpc.attribute_names_rpc(attrs_request)
    return {
        (attr_type, attribute.name)
        for attribute in attrs_response.attributes
        if attribute.name in requested_names
    }


def check_attributes_exist(
    resolver: SearchResolver,
    item_type: SupportedTraceItemType,
    attrs_by_type: dict[AttributeKey.Type.ValueType, list[ResolvedAttribute]],
) -> set[tuple[AttributeKey.Type.ValueType, str]]:
    """Check which typed attribute internal names exist in storage."""
    if not attrs_by_type:
        return set()

    meta = resolver.resolve_meta(referrer=Referrer.API_TRACE_ITEM_ATTRIBUTE_VALIDATE.value)
    meta.trace_item_type = constants.SUPPORTED_TRACE_ITEM_TYPE_MAP.get(
        item_type, TraceItemType.TRACE_ITEM_TYPE_SPAN
    )

    found: set[tuple[AttributeKey.Type.ValueType, str]] = set()
    with ContextPropagatingThreadPoolExecutor(
        thread_name_prefix="attr_validate",
        max_workers=MAX_ATTRIBUTE_VALIDATION_THREADS,
    ) as pool:
        futures = [
            pool.submit(_check_attributes_by_type, meta, attr_type, names)
            for attr_type, names in attrs_by_type.items()
        ]
        for future in futures:
            found.update(future.result())

    return found


class OrganizationEventsValidateEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def serialize_response(
        self,
        validity: ValidationResponse,
    ) -> Response:
        return Response(
            status=200 if validity.valid else 400,
            data=asdict(validity),
        )

    def get(self, request: Request, organization: Organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=400)

        response = ValidationResponse(valid=True)

        try:
            snuba_params = self.get_snuba_params(
                request,
                organization,
            )
        except NoProjects:
            response.valid = False
            response.projects.append(
                Validation(valid=False, error="At least one valid project is required to query")
            )

        try:
            dataset = self.get_dataset(request, organization)
        except ParseError as error:
            response.valid = False
            response.dataset.append(Validation(valid=False, error=str(error)))
            return self.serialize_response(response)

        if dataset not in RPC_DATASETS:
            response.dataset.append(
                Validation(
                    valid=True,
                    error="This dataset is not compatible with the validate endpoint, your request may still be valid",
                )
            )
            # Can't continue if this isn't a RPC dataset
            return self.serialize_response(response)

        resolver = dataset.get_resolver(snuba_params, SearchResolverConfig())
        definitions = resolver.definitions

        # Validate selected_columns
        selected_columns = self.get_field_list(organization, request)
        attributes_to_lookup = defaultdict(list)
        column_validity: list[AttributeValidation] = []
        for column in selected_columns:
            try:
                match = fields.is_function(column)
                if match:
                    resolved, _ = resolver.resolve_function(column, match)
                    column_validity.append(
                        AttributeValidation(
                            attrType=serialize_type(resolved.search_type),
                            error=None,
                            name=column,
                            valid=True,
                        )
                    )
                else:
                    resolved, _ = resolver.resolve_attribute(column)
                    if column in definitions.contexts or column in definitions.columns:
                        column_validity.append(
                            AttributeValidation(
                                attrType=serialize_type(resolved.search_type),
                                error="",
                                name=column,
                                valid=True,
                            )
                        )
                    else:
                        attributes_to_lookup[resolved.proto_type].append(resolved)
            except InvalidSearchQuery as error:
                response.valid = False
                column_validity.append(
                    AttributeValidation(
                        attrType=None,
                        error=str(error),
                        name=column,
                        valid=False,
                    )
                )

        if any(len(attributes) > 0 for attributes in attributes_to_lookup.values()):
            # Group by proto type because the storage check is keyed on
            # (proto_type, internal_name) — the same display name can exist
            # as both a string and a number attribute simultaneously.
            with handle_query_errors():
                existing = check_attributes_exist(resolver, dataset, attributes_to_lookup)
                for attribute_type, attributes in attributes_to_lookup.items():
                    for resolved in attributes:
                        if (resolved.proto_type, resolved.internal_name) in existing:
                            column_validity.append(
                                AttributeValidation(
                                    attrType=serialize_type(resolved.search_type),
                                    error="",
                                    name=resolved.public_alias,
                                    valid=True,
                                )
                            )
                        else:
                            response.valid = False
                            column_validity.append(
                                AttributeValidation(
                                    attrType=None,
                                    error="Unknown attribute",
                                    name=resolved.public_alias,
                                    valid=False,
                                )
                            )
        response.field = column_validity

        # Validate orderby
        orderby_validity = []
        orderby_columns = self.get_orderby(request)
        if orderby_columns:
            for orderby in orderby_columns:
                stripped_orderby = orderby.lstrip("-")
                found = False
                for field in column_validity:
                    if field.name == stripped_orderby:
                        orderby_validity.append(
                            AttributeValidation(
                                attrType=field.attrType, error=None, name=orderby, valid=True
                            )
                        )
                        found = True
                        break
                if not found:
                    response.valid = False
                    orderby_validity.append(
                        AttributeValidation(
                            attrType=None,
                            error="Orderby must also be a selected field",
                            name=orderby,
                            valid=False,
                        )
                    )
        response.orderby = orderby_validity

        # TODO(wmak): Validate query

        return self.serialize_response(response)
