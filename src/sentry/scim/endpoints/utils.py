from rest_framework.negotiation import BaseContentNegotiation

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models import AuthProvider

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
    content_negotiation_class = SCIMClientNegotiation
    cursor_name = "startIndex"

    def add_cursor_headers(self, request, response, cursor_result):
        pass


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
        if key == "userName":
            value = value.lower()
        else:
            raise ValueError  # only support the userName field right now

        if value[0] == '"' and value[-1] == '"':
            value = value.replace('"', "")
        if value[0] == "'" and value[-1] == "'":
            value = value.replace("'", "")
        filters.append([key, value])

    if len(filters) == 1 and filters[0][0] == "userName":
        filter_val = [filters[0][1]]
    else:
        filter_val = []
    return filter_val
