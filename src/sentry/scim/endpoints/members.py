from django.conf import settings
from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry import roles
from sentry.api.bases.organizationmember import OrganizationMemberEndpoint
from sentry.api.endpoints.organization_member_details import OrganizationMemberDetailsEndpoint
from sentry.api.endpoints.organization_member_index import OrganizationMemberSerializer
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization_member import OrganizationMemberSCIMSerializer
from sentry.models import AuditLogEntryEvent, AuthIdentity, InviteStatus, OrganizationMember
from sentry.signals import member_invited
from sentry.utils.cursors import SCIMCursor

from .constants import (
    SCIM_400_INVALID_FILTER,
    SCIM_400_INVALID_PATCH,
    SCIM_400_TOO_MANY_PATCH_OPS_ERROR,
    SCIM_409_USER_EXISTS,
    MemberPatchOps,
)
from .utils import OrganizationSCIMMemberPermission, SCIMEndpoint, parse_filter_conditions

ERR_ONLY_OWNER = "You cannot remove the only remaining owner of the organization."
from rest_framework.exceptions import PermissionDenied

from sentry.api.exceptions import ConflictError


class OrganizationSCIMMemberDetails(SCIMEndpoint, OrganizationMemberEndpoint):
    permission_classes = (OrganizationSCIMMemberPermission,)

    def _delete_member(self, request, organization, member):
        audit_data = member.get_audit_log_data()
        if OrganizationMemberDetailsEndpoint.is_only_owner(member):
            raise PermissionDenied(detail=ERR_ONLY_OWNER)
        with transaction.atomic():
            AuthIdentity.objects.filter(
                user=member.user, auth_provider__organization=organization
            ).delete()
            member.delete()
            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=member.id,
                target_user=member.user,
                event=AuditLogEntryEvent.MEMBER_REMOVE,
                data=audit_data,
            )

    def _should_delete_member(self, operation):
        if operation["op"].lower() == MemberPatchOps.REPLACE:
            if isinstance(operation["value"], dict) and operation["value"]["active"] is False:
                # how okta sets active to false
                return True
            elif operation["path"] == "active" and operation["value"] is False:
                # how other idps set active to false
                return True
        return False

    def get(self, request, organization, member):
        context = serialize(member, serializer=OrganizationMemberSCIMSerializer())
        return Response(context)

    def patch(self, request, organization, member):
        operations = request.data.get("Operations", [])
        if len(operations) > 100:
            return Response(SCIM_400_TOO_MANY_PATCH_OPS_ERROR, status=400)
        for operation in operations:
            # we only support setting active to False which deletes the orgmember
            if self._should_delete_member(operation):
                self._delete_member(request, organization, member)
                return Response(status=204)
            else:
                return Response(SCIM_400_INVALID_PATCH, status=400)

        context = serialize(member, serializer=OrganizationMemberSCIMSerializer())
        return Response(context)

    def delete(self, request, organization, member):
        self._delete_member(request, organization, member)
        return Response(status=204)


class OrganizationSCIMMemberIndex(SCIMEndpoint):
    permission_classes = (OrganizationSCIMMemberPermission,)

    def get(self, request, organization):
        # note that SCIM doesn't care about changing results as they're queried
        # TODO: sanitize get parameter inputs?
        try:
            filter_val = parse_filter_conditions(request.GET.get("filter"))
        except Exception:
            raise ParseError(detail=SCIM_400_INVALID_FILTER)

        queryset = (
            OrganizationMember.objects.filter(
                Q(invite_status=InviteStatus.APPROVED.value),
                Q(user__is_active=True) | Q(user__isnull=True),
                organization=organization,
            )
            .select_related("user")
            .order_by("email", "user__email")
        )
        if filter_val:
            queryset = queryset.filter(
                Q(email__in=filter_val) | Q(user__email__in=filter_val)
            )  # not including secondary email vals (dups, etc.)

        def data_fn(offset, limit):
            return list(queryset[offset : offset + limit])

        def on_results(results):
            results = serialize(results, None, OrganizationMemberSCIMSerializer())
            return self.list_api_format(request, queryset.count(), results)

        return self.paginate(
            request=request,
            on_results=on_results,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            default_per_page=int(request.GET.get("count", 100)),
            queryset=queryset,
            cursor_cls=SCIMCursor,
        )

    def post(self, request, organization):
        # TODO: confirm mixed case emails get converted to lowercase
        serializer = OrganizationMemberSerializer(
            data={
                "email": request.data.get("userName"),
                "role": roles.get(organization.default_role).id,
            },
            context={
                "organization": organization,
                "allowed_roles": [roles.get(organization.default_role)],
                "allow_existing_invite_request": True,
            },
        )

        if not serializer.is_valid():
            if "email" in serializer.errors and any(
                ("is already a member" in error) for error in serializer.errors["email"]
            ):
                # we include conflict logic in the serializer, check to see if that was
                # our error and if so, return a 409 so the scim IDP knows how to handle
                raise ConflictError(detail=SCIM_409_USER_EXISTS)
            return Response(serializer.errors, status=400)

        result = serializer.validated_data
        with transaction.atomic():
            member = OrganizationMember(
                organization=organization,
                email=result["email"],
                role=result["role"],
                inviter=request.user,
            )
            self.create_audit_entry(
                request=request,
                organization_id=organization.id,
                target_object=member.id,
                data=member.get_audit_log_data(),
                event=AuditLogEntryEvent.MEMBER_INVITE
                if settings.SENTRY_ENABLE_INVITES
                else AuditLogEntryEvent.MEMBER_ADD,
            )
            # TODO: are invite tokens needed for SAML orgs?
            if settings.SENTRY_ENABLE_INVITES:
                member.token = member.generate_token()
            member.save()

        if settings.SENTRY_ENABLE_INVITES and result.get("sendInvite"):
            member.send_invite_email()
            member_invited.send_robust(
                member=member,
                user=request.user,
                sender=self,
                referrer=request.data.get("referrer"),
            )

        context = serialize(member, serializer=OrganizationMemberSCIMSerializer())
        return Response(context, status=201)
