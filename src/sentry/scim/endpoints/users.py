from django.conf import settings
from django.db import transaction
from django.db.models import Q
from rest_framework import serializers
from rest_framework.response import Response

from sentry import roles
from sentry.api.endpoints.organization_member_details import OrganizationMemberDetailsEndpoint
from sentry.api.endpoints.organization_member_index import OrganizationMemberSerializer
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization_member import OrganizationMemberSCIMSerializer
from sentry.api.validators import AllowedEmailField
from sentry.models import AuditLogEntryEvent, AuthIdentity, OrganizationMember
from sentry.signals import member_invited

from .utils import SCIM_API_ERROR, SCIMEndpoint, parse_filter_conditions

ERR_ONLY_OWNER = "You cannot remove the only remaining owner of the organization."

SCIM_404_USER_RES = {
    "schemas": [SCIM_API_ERROR],
    "detail": "User not found.",
}


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
    def get(self, request, organization, member_id):
        try:
            member = OrganizationMember.objects.get(organization=organization, id=member_id)
        except OrganizationMember.DoesNotExist:
            return Response(SCIM_404_USER_RES, status=404)
        except AssertionError as error:
            if str(error) == "value too large":
                return Response(SCIM_404_USER_RES, status=404)
            raise error

        context = serialize(member, serializer=OrganizationMemberSCIMSerializer())
        return Response(context)

    def patch(self, request, organization, member_id):
        try:
            member = OrganizationMember.objects.get(organization=organization, id=member_id)
        except OrganizationMember.DoesNotExist:
            return Response(SCIM_404_USER_RES, status=404)
        except AssertionError as error:
            if str(error) == "value too large":
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
            om = OrganizationMember.objects.get(organization=organization, id=member_id)
        except OrganizationMember.DoesNotExist:
            return Response(SCIM_404_USER_RES, status=404)
        except AssertionError as error:
            if str(error) == "value too large":
                return Response(SCIM_404_USER_RES, status=404)
        audit_data = om.get_audit_log_data()
        if self._is_only_owner(om):
            return Response({"detail": ERR_ONLY_OWNER}, status=403)
        with transaction.atomic():
            AuthIdentity.objects.filter(
                user=om.user, auth_provider__organization=organization
            ).delete()
            om.delete()
        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=om.id,
            target_user=om.user,
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
                # Q(user__is_active=True) | Q(user__isnull=True),
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
            return Response(
                {
                    "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
                    "detail": "User already exists in the database.",
                },
                status=409,
            )

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
