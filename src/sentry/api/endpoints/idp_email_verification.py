from django.http.response import HttpResponseRedirect
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.auth.idpmigration import verify_new_identity
from sentry.models import Organization
from sentry.utils.auth import get_login_url


class IDPEmailVerificationSerializer(serializers.Serializer):
    one_time_key = serializers.CharField()


class IDPEmailVerificationPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
    }


class IDPEmailVerificationEndpoint(OrganizationEndpoint):
    permission_classes = (IDPEmailVerificationPermission,)

    def get(self, request: Request, organization: Organization, key: str) -> Response:
        verification_key = verify_new_identity(key)
        if verification_key:
            request.session["verification_key"] = verification_key
            login = get_login_url()
            redirect = HttpResponseRedirect(login)
            return redirect
        return self.respond(status=401)

    def post(self, request: Request, organization: Organization) -> Response:
        serializer = IDPEmailVerificationSerializer(data=request.data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        result = serializer.validated_data
        verification_key = verify_new_identity(result["one_time_key"])
        if verification_key:
            request.session["verification_key"] = verification_key
            login = get_login_url()
            redirect = HttpResponseRedirect(login)
            return redirect
        return self.respond(status=401)
