import logging
from datetime import datetime

import pytz
from django.conf import settings
from django.contrib.auth import logout
from django.db import router, transaction
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import roles
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.endpoints.organization_details import post_org_pending_deletion
from sentry.api.serializers import serialize
from sentry.api.serializers.models.user import DetailedSelfUserSerializer
from sentry.api.serializers.rest_framework import CamelSnakeModelSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.constants import LANGUAGES
from sentry.models.options.user_option import UserOption
from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.user import User
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.services.hybrid_cloud.organization.model import RpcOrganizationDeleteState
from sentry.services.hybrid_cloud.user.serial import serialize_generic_user

audit_logger = logging.getLogger("sentry.audit.user")
delete_logger = logging.getLogger("sentry.deletions.api")


def _get_timezone_choices():
    results = []
    for tz in pytz.all_timezones:
        now = datetime.now(pytz.timezone(tz))
        offset = now.strftime("%z")
        results.append((int(offset), tz, f"(UTC{offset}) {tz}"))
    results.sort()

    for i in range(len(results)):
        results[i] = results[i][1:]
    return results


TIMEZONE_CHOICES = _get_timezone_choices()


class UserOptionsSerializer(serializers.Serializer):
    language = serializers.ChoiceField(choices=LANGUAGES, required=False)
    stacktraceOrder = serializers.ChoiceField(
        choices=(
            ("-1", _("Default (let Sentry decide)")),
            ("1", _("Most recent call last")),
            ("2", _("Most recent call first")),
        ),
        required=False,
    )
    timezone = serializers.ChoiceField(choices=TIMEZONE_CHOICES, required=False)
    clock24Hours = serializers.BooleanField(required=False)
    theme = serializers.ChoiceField(
        choices=(
            ("light", _("Light")),
            ("dark", _("Dark")),
            ("system", _("Default to system")),
        ),
        required=False,
    )
    defaultIssueEvent = serializers.ChoiceField(
        choices=(
            ("recommended", _("Recommended")),
            ("latest", _("Latest")),
            ("oldest", _("Oldest")),
        ),
        required=False,
    )


class BaseUserSerializer(CamelSnakeModelSerializer):
    def validate_username(self, value):
        if (
            User.objects.filter(username__iexact=value)
            # Django throws an exception if `id` is `None`, which it will be when we're importing
            # new users via the relocation logic on the `User` model. So we cast `None` to `0` to
            # make Django happy here.
            .exclude(id=self.instance.id if hasattr(self.instance, "id") else 0).exists()
        ):
            raise serializers.ValidationError("That username is already in use.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)

        if self.instance.email == self.instance.username:
            if attrs.get("username", self.instance.email) != self.instance.email:
                # ... this probably needs to handle newsletters and such?
                attrs.setdefault("email", attrs["username"])

        return attrs

    def update(self, instance, validated_data):
        if "isActive" not in validated_data:
            validated_data["isActive"] = instance.is_active
        return super().update(instance, validated_data)


class UserSerializer(BaseUserSerializer):
    class Meta:
        model = User
        fields = ("name", "username")

    def validate(self, attrs):
        for field in settings.SENTRY_MANAGED_USER_FIELDS:
            attrs.pop(field, None)

        return super().validate(attrs)


class SuperuserUserSerializer(BaseUserSerializer):
    is_active = serializers.BooleanField()

    class Meta:
        model = User
        fields = ("name", "username", "is_active")


class PrivilegedUserSerializer(SuperuserUserSerializer):
    is_staff = serializers.BooleanField()
    is_superuser = serializers.BooleanField()

    class Meta:
        model = User
        fields = ("name", "username", "is_active", "is_staff", "is_superuser")


class DeleteUserSerializer(serializers.Serializer):
    organizations = serializers.ListField(
        child=serializers.CharField(required=False), required=True
    )
    hardDelete = serializers.BooleanField(required=False)


@control_silo_endpoint
class UserDetailsEndpoint(UserEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, user) -> Response:
        """
        Retrieve User Details
        `````````````````````

        Return details for an account's details and options such as: full name, timezone, 24hr times, language,
        stacktrace_order.

        :auth: required
        """
        return Response(serialize(user, request.user, DetailedSelfUserSerializer()))

    def put(self, request: Request, user) -> Response:
        """
        Update Account Appearance options
        `````````````````````````````````

        Update account appearance options. Only supplied values are updated.

        :pparam string user_id: user id
        :param string language: language preference
        :param string stacktrace_order: One of -1 (default), 1 (most recent call last), 2 (most recent call first).
        :param string timezone: timezone option
        :param clock_24_hours boolean: use 24 hour clock
        :param string theme: UI theme, either "light", "dark", or "system"
        :param string default_issue_event: Event displayed by default, "recommended", "latest" or "oldest"
        :auth: required
        """
        if not request.access.has_permission("users.admin"):
            if not user.is_superuser and request.data.get("isSuperuser"):
                return Response(
                    {"detail": "Missing required permission to add superuser."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            elif not user.is_staff and request.data.get("isStaff"):
                return Response(
                    {"detail": "Missing required permission to add admin."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        if request.access.has_permission("users.admin"):
            serializer_cls = PrivilegedUserSerializer
        elif is_active_superuser(request):
            serializer_cls = SuperuserUserSerializer
        else:
            serializer_cls = UserSerializer
        serializer = serializer_cls(instance=user, data=request.data, partial=True)

        serializer_options = UserOptionsSerializer(
            data=request.data.get("options", {}), partial=True
        )

        # This serializer should NOT include privileged fields e.g. password
        if not serializer.is_valid() or not serializer_options.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # map API keys to keys in model
        key_map = {
            "theme": "theme",
            "language": "language",
            "timezone": "timezone",
            "stacktraceOrder": "stacktrace_order",
            "defaultIssueEvent": "default_issue_event",
            "clock24Hours": "clock_24_hours",
        }

        options_result = serializer_options.validated_data

        for key in key_map:
            if key in options_result:
                UserOption.objects.set_value(
                    user=user, key=key_map.get(key, key), value=options_result.get(key)
                )

        with transaction.atomic(using=router.db_for_write(User)):
            user = serializer.save()

            if any(k in request.data for k in ("isStaff", "isSuperuser", "isActive")):
                audit_logger.info(
                    "user.edit",
                    extra={
                        "user_id": user.id,
                        "actor_id": request.user.id,
                        "form_data": request.data,
                    },
                )

        return Response(serialize(user, request.user, DetailedSelfUserSerializer()))

    @sudo_required
    def delete(self, request: Request, user) -> Response:
        """
        Delete User Account

        Also removes organizations if they are an owner
        :pparam string user_id: user id
        :param boolean hard_delete: Completely remove the user from the database (requires super user)
        :param list organizations: List of organization ids to remove
        :auth required:
        """

        serializer = DeleteUserSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(status=status.HTTP_400_BAD_REQUEST)

        # from `frontend/remove_account.py`
        org_mappings = OrganizationMapping.objects.filter(
            organization_id__in=OrganizationMemberMapping.objects.filter(
                user_id=user.id, role__in=[r.id for r in roles.with_scope("org:admin")]
            ).values("organization_id"),
            status=OrganizationStatus.ACTIVE,
        )

        org_results = []
        for org in org_mappings:
            first_two_owners = OrganizationMemberMapping.objects.filter(
                organization_id=org.organization_id, role__in=[roles.get_top_dog().id]
            )[:2]
            has_single_owner = len(first_two_owners) == 1
            org_results.append(
                {
                    "organization_id": org.organization_id,
                    "single_owner": has_single_owner,
                }
            )

        avail_org_ids = {o["organization_id"] for o in org_results}
        requested_org_slugs_to_remove = set(serializer.validated_data.get("organizations"))
        requested_org_ids_to_remove = OrganizationMapping.objects.filter(
            slug__in=requested_org_slugs_to_remove
        ).values_list("organization_id", flat=True)

        orgs_to_remove = set(requested_org_ids_to_remove).intersection(avail_org_ids)

        for result in org_results:
            if result["single_owner"]:
                orgs_to_remove.add(result["organization_id"])

        for org_id in orgs_to_remove:
            org_delete_response = organization_service.delete_organization(
                organization_id=org_id, user=serialize_generic_user(request.user)
            )
            if org_delete_response.response_state == RpcOrganizationDeleteState.PENDING_DELETION:
                post_org_pending_deletion(
                    request=request,
                    org_delete_response=org_delete_response,
                )

        remaining_org_ids = [
            o.organization_id
            for o in org_mappings
            if o.organization_id in avail_org_ids.difference(orgs_to_remove)
        ]

        if remaining_org_ids:
            for member_mapping in OrganizationMemberMapping.objects.filter(
                organization_id__in=remaining_org_ids, user_id=user.id
            ):
                organization_service.delete_organization_member(
                    organization_id=member_mapping.organization_id,
                    organization_member_id=member_mapping.organizationmember_id,
                )

        logging_data = {
            "actor_id": request.user.id,
            "ip_address": request.META["REMOTE_ADDR"],
            "user_id": user.id,
        }

        hard_delete = serializer.validated_data.get("hardDelete", False)

        # Only active superusers can hard delete accounts
        if hard_delete and not request.access.has_permission("users.admin"):
            return Response(
                {"detail": "Missing required permission to hard delete account."},
                status=status.HTTP_403_FORBIDDEN,
            )

        is_current_user = request.user.id == user.id

        if hard_delete:
            user.delete()
            delete_logger.info("user.removed", extra=logging_data)
        else:
            User.objects.filter(id=user.id).update(is_active=False)
            delete_logger.info("user.deactivate", extra=logging_data)

        # if the user deleted their own account log them out
        if is_current_user:
            logout(request)

        return Response(status=status.HTTP_204_NO_CONTENT)
