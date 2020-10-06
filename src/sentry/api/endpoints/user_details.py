from __future__ import absolute_import

from datetime import datetime

import pytz
import logging

from django.conf import settings
from django.utils.translation import ugettext_lazy as _
from django.contrib.auth import logout
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry import roles
from sentry.api import client
from sentry.api.bases.user import UserEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.api.serializers.models.user import DetailedUserSerializer
from sentry.api.serializers.rest_framework import ListField
from sentry.auth.superuser import is_active_superuser
from sentry.constants import LANGUAGES
from sentry.models import Organization, OrganizationMember, OrganizationStatus, User, UserOption

delete_logger = logging.getLogger("sentry.deletions.ui")


def _get_timezone_choices():
    results = []
    for tz in pytz.common_timezones:
        now = datetime.now(pytz.timezone(tz))
        offset = now.strftime("%z")
        results.append((int(offset), tz, "(UTC%s) %s" % (offset, tz)))
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


class BaseUserSerializer(serializers.ModelSerializer):
    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exclude(id=self.instance.id).exists():
            raise serializers.ValidationError("That username is already in use.")
        return value

    def validate(self, attrs):
        attrs = super(BaseUserSerializer, self).validate(attrs)

        if self.instance.email == self.instance.username:
            if attrs.get("username", self.instance.email) != self.instance.email:
                # ... this probably needs to handle newsletters and such?
                attrs.setdefault("email", attrs["username"])

        return attrs

    def update(self, instance, validated_data):
        if "isActive" not in validated_data:
            validated_data["isActive"] = instance.is_active
        return super(BaseUserSerializer, self).update(instance, validated_data)


class UserSerializer(BaseUserSerializer):
    class Meta:
        model = User
        fields = ("name", "username")

    def validate(self, attrs):
        for field in settings.SENTRY_MANAGED_USER_FIELDS:
            attrs.pop(field, None)

        return super(UserSerializer, self).validate(attrs)


class SuperuserUserSerializer(BaseUserSerializer):
    isActive = serializers.BooleanField(source="is_active")
    isStaff = serializers.BooleanField(source="is_staff")
    isSuperuser = serializers.BooleanField(source="is_superuser")

    class Meta:
        model = User
        # no idea wtf is up with django rest framework, but we need is_active
        # and isActive
        fields = ("name", "username", "isActive", "isStaff", "isSuperuser")


class DeleteUserSerializer(serializers.Serializer):
    organizations = ListField(child=serializers.CharField(required=False), required=True)
    hardDelete = serializers.BooleanField(required=False)


class UserDetailsEndpoint(UserEndpoint):
    def get(self, request, user):
        """
        Retrieve User Details
        `````````````````````

        Return details for an account's details and options such as: full name, timezone, 24hr times, language,
        stacktrace_order.

        :auth: required
        """
        return Response(serialize(user, request.user, DetailedUserSerializer()))

    def put(self, request, user):
        """
        Update Account Appearance options
        `````````````````````````````````

        Update account appearance options. Only supplied values are updated.

        :pparam string user_id: user id
        :param string language: language preference
        :param string stacktrace_order: One of -1 (default), 1 (most recent call last), 2 (most recent call first).
        :param string timezone: timezone option
        :param clock_24_hours boolean: use 24 hour clock
        :auth: required
        """

        if is_active_superuser(request):
            serializer_cls = SuperuserUserSerializer
        else:
            serializer_cls = UserSerializer
        serializer = serializer_cls(user, data=request.data, partial=True)

        serializer_options = UserOptionsSerializer(
            data=request.data.get("options", {}), partial=True
        )

        # This serializer should NOT include privileged fields e.g. password
        if not serializer.is_valid() or not serializer_options.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # map API keys to keys in model
        key_map = {
            "language": "language",
            "timezone": "timezone",
            "stacktraceOrder": "stacktrace_order",
            "clock24Hours": "clock_24_hours",
        }

        options_result = serializer_options.validated_data

        for key in key_map:
            if key in options_result:
                UserOption.objects.set_value(
                    user=user, key=key_map.get(key, key), value=options_result.get(key)
                )

        user = serializer.save()

        return Response(serialize(user, request.user, DetailedUserSerializer()))

    @sudo_required
    def delete(self, request, user):
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
        org_list = Organization.objects.filter(
            member_set__role__in=[x.id for x in roles.with_scope("org:admin")],
            member_set__user=user,
            status=OrganizationStatus.VISIBLE,
        )

        org_results = []
        for org in org_list:
            org_results.append({"organization": org, "single_owner": org.has_single_owner()})

        avail_org_slugs = set([o["organization"].slug for o in org_results])
        orgs_to_remove = set(serializer.validated_data.get("organizations")).intersection(
            avail_org_slugs
        )

        for result in org_results:
            if result["single_owner"]:
                orgs_to_remove.add(result["organization"].slug)

        for org_slug in orgs_to_remove:
            client.delete(
                path=u"/organizations/{}/".format(org_slug), request=request, is_sudo=True
            )

        remaining_org_ids = [
            o.id for o in org_list if o.slug in avail_org_slugs.difference(orgs_to_remove)
        ]

        if remaining_org_ids:
            OrganizationMember.objects.filter(
                organization__in=remaining_org_ids, user=user
            ).delete()

        logging_data = {
            "actor_id": request.user.id,
            "ip_address": request.META["REMOTE_ADDR"],
            "user_id": user.id,
        }

        hard_delete = serializer.validated_data.get("hardDelete", False)

        # Only active superusers can hard delete accounts
        if hard_delete and not is_active_superuser(request):
            return Response(
                {"detail": "Only superusers may hard delete a user account"},
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
