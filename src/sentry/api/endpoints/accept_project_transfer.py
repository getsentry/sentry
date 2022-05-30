from django.core.signing import BadSignature, SignatureExpired
from django.http import Http404
from django.utils.encoding import force_str
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, roles
from sentry.api.base import Endpoint, SessionAuthentication
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization import (
    DetailedOrganizationSerializerWithProjectsAndTeams,
)
from sentry.models import Organization, OrganizationMember, OrganizationStatus, Project
from sentry.utils import metrics
from sentry.utils.signing import unsign


class InvalidPayload(Exception):
    pass


class AcceptProjectTransferEndpoint(Endpoint):
    authentication_classes = (SessionAuthentication,)
    permission_classes = (IsAuthenticated,)

    def get_validated_data(self, data, user):
        try:
            data = unsign(force_str(data))
        except SignatureExpired:
            raise InvalidPayload("Project transfer link has expired.")
        except BadSignature:
            raise InvalidPayload("Could not approve transfer, please make sure link is valid.")

        if data["user_id"] != user.id:
            raise InvalidPayload("Invalid permissions")

        try:
            project = Project.objects.get(
                id=data["project_id"], organization_id=data["from_organization_id"]
            )
        except Project.DoesNotExist:
            raise InvalidPayload("Project no longer exists")

        return data, project

    @sudo_required
    def get(self, request: Request) -> Response:
        try:
            data = request.GET["data"]
        except KeyError:
            raise Http404

        try:
            data, project = self.get_validated_data(data, request.user)
        except InvalidPayload as e:
            return Response({"detail": str(e)}, status=400)

        organizations = Organization.objects.filter(
            status=OrganizationStatus.ACTIVE,
            id__in=OrganizationMember.objects.filter(
                user=request.user, role=roles.get_top_dog().id
            ).values_list("organization_id", flat=True),
        )

        return Response(
            {
                "organizations": serialize(
                    list(organizations),
                    request.user,
                    DetailedOrganizationSerializerWithProjectsAndTeams(),
                    access=request.access,
                ),
                "project": {"slug": project.slug, "id": project.id},
            }
        )

    @sudo_required
    def post(self, request: Request) -> Response:
        try:
            data = request.data["data"]
        except KeyError:
            raise Http404

        try:
            data, project = self.get_validated_data(data, request.user)
        except InvalidPayload as e:
            return Response({"detail": str(e)}, status=400)

        transaction_id = data["transaction_id"]

        org_slug = request.data.get("organization")
        # DEPRECATED
        team_id = request.data.get("team")

        if org_slug is None and team_id is not None:
            metrics.incr("accept_project_transfer.post.to_team")
            return Response({"detail": "Cannot transfer projects to a team."}, status=400)

        try:
            organization = Organization.objects.get(slug=org_slug)
        except Organization.DoesNotExist:
            return Response({"detail": "Invalid organization"}, status=400)

        # check if user is an owner of the organization
        is_org_owner = OrganizationMember.objects.filter(
            user__is_active=True,
            user=request.user,
            role=roles.get_top_dog().id,
            organization_id=organization.id,
        ).exists()

        if not is_org_owner:
            return Response({"detail": "Invalid organization"}, status=400)

        project.transfer_to(organization=organization)

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=project.id,
            event=audit_log.get_event_id("PROJECT_ACCEPT_TRANSFER"),
            data=project.get_audit_log_data(),
            transaction_id=transaction_id,
        )

        return Response(status=204)
