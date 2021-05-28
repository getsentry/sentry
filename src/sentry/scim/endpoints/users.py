from django.conf import settings
from django.db import transaction
from django.db.models import Q
from rest_framework import serializers
from rest_framework.response import Response

from sentry import roles
from sentry.api.endpoints.organization_member_details import OrganizationMemberDetailsEndpoint
from sentry.api.endpoints.organization_member_index import OrganizationMemberSerializer
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization_member import OrganizationMemberSCIMSerializer
from sentry.api.validators import AllowedEmailField
from sentry.models import AuditLogEntryEvent, AuthIdentity, InviteStatus, OrganizationMember
from sentry.signals import member_invited

from .constants import SCIM_404_USER_RES, SCIM_409_USER_EXISTS
from .utils import SCIMEndpoint, parse_filter_conditions

ERR_ONLY_OWNER = "You cannot remove the only remaining owner of the organization."


class SCIMUserSerializer(serializers.Serializer):
    email = AllowedEmailField(max_length=75, required=True)
    role = serializers.ChoiceField(choices=roles.get_choices(), required=True)
    sendInvite = serializers.BooleanField(required=False, default=True, write_only=True)

    def validate_email(self, email):
        queryset = OrganizationMember.objects.filter(
            Q(email=email) | Q(user__email__iexact=email, user__is_active=True),
            organization=self.context["organization"],
        )

        if queryset.filter.exists():
            raise serializers.ValidationError("User already exists in the database.")
        return email


class OrganizationSCIMUserDetails(SCIMEndpoint, OrganizationMemberDetailsEndpoint):
    def _get_member(self, organization, member_id):
        try:
            member = OrganizationMember.objects.get(
                organization=organization,
                id=member_id,
                invite_status=InviteStatus.APPROVED.value,
            )
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist
        except AssertionError as error:
            if str(error) == "value too large":
                raise ResourceDoesNotExist
            raise error
        return member

    def get(self, request, organization, member_id):
        try:
            member = self._get_member(organization, member_id)
        except ResourceDoesNotExist:
            return Response(SCIM_404_USER_RES, status=404)

        context = serialize(member, serializer=OrganizationMemberSCIMSerializer())
        return Response(context)

    def patch(self, request, organization, member_id):
        try:
            member = self._get_member(organization, member_id)
        except ResourceDoesNotExist:
            return Response(SCIM_404_USER_RES, status=404)

        for operation in request.data.get("Operations", []):
            # we only support setting active to False which deletes the orgmember
            if operation["value"]["active"] is False:
                audit_data = member.get_audit_log_data()
                if self._is_only_owner(member):
                    return Response({"detail": ERR_ONLY_OWNER}, status=403)
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
                return Response(status=204)
        context = serialize(member, serializer=OrganizationMemberSCIMSerializer())
        return Response(context)

    def delete(self, request, organization, member_id):
        try:
            member = self._get_member(organization, member_id)
        except ResourceDoesNotExist:
            return Response(SCIM_404_USER_RES, status=404)

        audit_data = member.get_audit_log_data()
        if self._is_only_owner(member):
            return Response({"detail": ERR_ONLY_OWNER}, status=403)
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

        return Response(status=204)


class OrganizationSCIMUserIndex(SCIMEndpoint):
    def get(self, request, organization):
        # note that SCIM doesn't care about changing results as they're queried
        # TODO: sanitize get parameter inputs?

        filter_val = parse_filter_conditions(request.GET.get("filter"))

        queryset = (
            OrganizationMember.objects.filter(
                Q(invite_status=InviteStatus.APPROVED.value),
                organization=organization,
            )
            .select_related("user")
            .order_by("email", "user__email")
        )
        if filter_val:
            queryset = queryset.filter(
                Q(email__in=filter_val)
                | Q(user__email__in=filter_val)
                | Q(user__emails__email__in=filter_val)
            )

        # TODO: how is queryset ordered?

        def data_fn(offset, limit):
            return list(queryset[offset : offset + limit])

        return self.paginate(
            request=request,
            on_results=lambda results: serialize(results, None, OrganizationMemberSCIMSerializer()),
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            default_per_page=int(request.GET.get("count", 100)),
            queryset=queryset,
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
            # TODO: other ways this could be invalid?
            return Response(SCIM_409_USER_EXISTS, status=409)

        result = serializer.validated_data
        with transaction.atomic():
            member = OrganizationMember(
                organization=organization,
                email=result["email"],
                role=result["role"],
                inviter=request.user,
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

        self.create_audit_entry(
            request=request,
            organization_id=organization.id,
            target_object=member.id,
            data=member.get_audit_log_data(),
            event=AuditLogEntryEvent.MEMBER_INVITE
            if settings.SENTRY_ENABLE_INVITES
            else AuditLogEntryEvent.MEMBER_ADD,
        )

        context = serialize(member, serializer=OrganizationMemberSCIMSerializer())
        return Response(context, status=201)
