from typing import Iterable

from rest_framework.response import Response

from sentry.api.base import MethodVersion, VersionedEndpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.apidocs.decorators import public


@public(methods={"GET"})
class OrganizationSlugLengthEndpoint(OrganizationEndpoint, VersionedEndpoint):
    # This is an intentionally simple (and silly) example invented for the purpose of
    # demonstrating both how to declare a versioned endpoint and how it interacts
    # with automatic API docs generation.
    #
    # If you ever see this code outside of a draft PR, something is wrong.

    @classmethod
    def declare_method_versions(cls) -> Iterable[MethodVersion]:
        yield MethodVersion(cls.get_v1, "get", 1)
        yield MethodVersion(cls.get_v2, "get", 2)

    def get_v1(self, request, organization):
        data = {"slugLongth": len(organization.slug)}
        return Response(serialize(data))

    def get_v2(self, request, organization):
        # Oops, v1 had a typo in an attribute name. Our most spelling-conscious users
        # demand a fix, but we can't alter the old response without breaking
        # backwards compatibility. Thus, a new version.
        data = {"slugLength": len(organization.slug)}
        return Response(serialize(data))
