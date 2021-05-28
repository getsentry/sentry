import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.negotiation import BaseContentNegotiation
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import BadPaginationError, GenericOffsetPaginator
from sentry.models import AuthProvider
from sentry.utils.cursors import Cursor

from .constants import SCIM_API_LIST


class IgnoreClientContentNegotiation(BaseContentNegotiation):
    # TODO: validate scim content type
    def select_parser(self, request, parsers):
        """
        Select the first parser in the `.parser_classes` list.
        """
        return parsers[0]

    def select_renderer(self, request, renderers, format_suffix):
        """
        Select the first renderer in the `.renderer_classes` list.
        """
        return (renderers[0], renderers[0].media_type)


class OrganizationSCIMPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "POST": ["member:write", "member:admin"],
        "PATCH": ["member:write", "member:admin"],
        "PUT": ["member:write", "member:admin"],
        "DELETE": ["member:admin"],
    }

    def has_object_permission(self, request, view, organization):
        result = super().has_object_permission(request, view, organization)
        # The scim endpoints should only be used in conjunction with a SAML2 integration
        if not result:
            return result
        try:
            auth_provider = AuthProvider.objects.get(organization=organization)
        except AuthProvider.DoesNotExist:
            return False
        if not auth_provider.flags.scim_enabled:
            return False

        return True


class SCIMEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationSCIMPermission,)
    content_negotiation_class = IgnoreClientContentNegotiation

    def paginate(
        self,
        request,
        on_results=None,
        paginator=None,
        paginator_cls=GenericOffsetPaginator,
        default_per_page=100,
        max_per_page=100,
        cursor_cls=Cursor,
        **paginator_kwargs,
    ):
        assert (paginator and not paginator_kwargs) or (paginator_cls and paginator_kwargs)

        per_page = self.get_per_page(request, default_per_page, max_per_page)

        input_cursor = None
        if request.GET.get("startIndex"):
            # XXX: SCIM startIndex param is 1 indexed
            try:
                input_cursor = Cursor(0, int(request.GET.get("startIndex")) - 1, 0)
            except ValueError:
                raise ParseError(detail="Invalid cursor parameter.")

        try:
            with sentry_sdk.start_span(
                op="base.paginate.get_result",
                description=type(self).__name__,
            ) as span:
                span.set_data("Limit", per_page)
                cursor_result = paginator.get_result(limit=per_page, cursor=input_cursor)
        except BadPaginationError as e:
            raise ParseError(detail=str(e))

        # map results based on callback
        if on_results:
            with sentry_sdk.start_span(
                op="base.paginate.on_results",
                description=type(self).__name__,
            ):
                results = on_results(cursor_result.results)
        else:
            results = cursor_result.results
        context = {
            "schemas": [SCIM_API_LIST],
            "totalResults": paginator_kwargs["queryset"].count(),  # TODO: audit perf
            "startIndex": int(request.GET.get("startIndex", 1)),  # must be integer
            "itemsPerPage": len(results),  # what's max?
            "Resources": results,
        }
        return Response(context)


def parse_filter_conditions(raw_filters):
    # TODO: support "and" operator
    # TODO: support email querying/filtering
    filters = []
    if raw_filters is None:
        return filters
    conditions = raw_filters.split(",")

    for c in conditions:
        [key, value] = c.split(" eq ")
        if not key or not value:
            continue

        key = key.strip()
        value = value.strip()

        # For USERS: Unique username should always be lowercase
        if key == "userName":
            value = value.lower()

        if value[0] == '"' and value[-1] == '"':
            value = value.replace('"', "")
        if value[0] == "'" and value[-1] == "'":
            value = value.replace("'", "")
        filters.append([key, value])
    if len(filters) > 0:
        filter_val = [filters[0][1]]
    else:
        filter_val = None
    return filter_val
