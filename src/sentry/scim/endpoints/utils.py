import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.negotiation import BaseContentNegotiation
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import BadPaginationError, GenericOffsetPaginator
from sentry.models import AuthProvider
from sentry.utils.cursors import Cursor

from .constants import SCIM_API_LIST

SCIM_CONTENT_TYPES = ["application/json", "application/json+scim"]


class SCIMClientNegotiation(BaseContentNegotiation):
    # SCIM uses the content type "application/json+scim"
    # which is just json for our purposes.
    def select_parser(self, request, parsers):
        """
        Select the first parser in the `.parser_classes` list.
        """
        for parser in parsers:
            if parser.media_type in SCIM_CONTENT_TYPES:
                return parser

    def select_renderer(self, request, renderers, format_suffix):
        """
        Select the first renderer in the `.renderer_classes` list.
        """
        for renderer in renderers:
            if renderer.media_type in SCIM_CONTENT_TYPES:
                return (renderer, renderer.media_type)


class OrganizationSCIMPermission(OrganizationPermission):
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


class OrganizationSCIMMemberPermission(OrganizationSCIMPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "POST": ["member:write", "member:admin"],
        "PATCH": ["member:write", "member:admin"],
        "PUT": ["member:write", "member:admin"],
        "DELETE": ["member:admin"],
    }


class OrganizationSCIMTeamPermission(OrganizationSCIMPermission):
    scope_map = {
        "GET": ["team:read", "team:write", "team:admin"],
        "POST": ["team:write", "team:admin"],
        "PATCH": ["team:write", "team:admin"],
        "DELETE": ["team:admin"],
    }


class SCIMEndpoint(OrganizationEndpoint):
    content_negotiation_class = SCIMClientNegotiation

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
    """
    this function parses a scim filter, see:
    https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2.2

    right now the only subset of that filtering we support is the simple "eq"
    operator. the input would look like so:
    userName eq "test.user@okta.local"

    the only field we support filtering on is userName, so this function
    simply returns the email within the above quotes currently.
    We may want to support further SCIM grammar for other IDPs and may use
    a package to replace this functionality.
    """
    # TODO: support "and" operator
    # TODO: support email querying/filtering
    # TODO: graceful error handling when unsupported operators are used
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
        if value[0] == '"' and value[-1] == '"':
            value = value.replace('"', "")
        if value[0] == "'" and value[-1] == "'":
            value = value.replace("'", "")

        if key == "userName":
            value = value.lower()
        elif key == "value":
            value = int(value)
        elif key == "displayName":
            pass
        else:
            raise ValueError  # only support above fields
        filters.append([key, value])

    if len(filters) == 1:
        filter_val = [filters[0][1]]
    else:
        filter_val = []
    return filter_val
