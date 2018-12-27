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

delete_logger = logging.getLogger('sentry.deletions.ui')


def _get_timezone_choices():
    results = []
    for tz in pytz.common_timezones:
        now = datetime.now(pytz.timezone(tz))
        offset = now.strftime('%z')
        results.append((int(offset), tz, '(UTC%s) %s' % (offset, tz)))
    results.sort()

    for i in range(len(results)):
        results[i] = results[i][1:]
    return results


TIMEZONE_CHOICES = _get_timezone_choices()


class UserOptionsSerializer(serializers.Serializer):
    language = serializers.ChoiceField(choices=LANGUAGES, required=False)
    stacktraceOrder = serializers.ChoiceField(choices=(
        ('-1', _('Default (let Sentry decide)')),
        ('1', _('Most recent call last')),
        ('2', _('Most recent call first')),
    ), required=False)
    timezone = serializers.ChoiceField(choices=TIMEZONE_CHOICES, required=False)
    clock24Hours = serializers.BooleanField(required=False)
    seenReleaseBroadcast = serializers.BooleanField(required=False)


class BaseUserSerializer(serializers.ModelSerializer):
    def validate_username(self, attrs, source):
        value = attrs[source]
        if User.objects.filter(username__iexact=value).exclude(id=self.object.id).exists():
            raise serializers.ValidationError('That username is already in use.')
        return attrs

    def validate(self, attrs):
        attrs = super(BaseUserSerializer, self).validate(attrs)

        if self.object.email == self.object.username:
            if attrs.get('username', self.object.email) != self.object.email:
                # ... this probably needs to handle newsletters and such?
                attrs.setdefault('email', attrs['username'])

        return attrs

    def restore_object(self, attrs, instance=None):
        instance = super(BaseUserSerializer, self).restore_object(attrs, instance)
        instance.is_active = attrs.get('isActive', instance.is_active)
        return instance


class UserSerializer(BaseUserSerializer):
    class Meta:
        model = User
        fields = ('name', 'username')

    def validate(self, attrs):
        for field in settings.SENTRY_MANAGED_USER_FIELDS:
            attrs.pop(field, None)

        return super(UserSerializer, self).validate(attrs)


class AdminUserSerializer(BaseUserSerializer):
    isActive = serializers.BooleanField(source='is_active')

    class Meta:
        model = User
        # no idea wtf is up with django rest framework, but we need is_active
        # and isActive
        fields = ('name', 'username', 'isActive')
        # write_only_fields = ('password',)


class OrganizationsSerializer(serializers.Serializer):
    organizations = ListField(child=serializers.CharField(required=False), required=True)


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
            serializer_cls = AdminUserSerializer
        else:
            serializer_cls = UserSerializer
        serializer = serializer_cls(user, data=request.DATA, partial=True)

        serializer_options = UserOptionsSerializer(
            data=request.DATA.get('options', {}), partial=True)

        # This serializer should NOT include privileged fields e.g. password
        if not serializer.is_valid() or not serializer_options.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # map API keys to keys in model
        key_map = {
            'language': 'language',
            'timezone': 'timezone',
            'stacktraceOrder': 'stacktrace_order',
            'clock24Hours': 'clock_24_hours',
            'seenReleaseBroadcast': 'seen_release_broadcast',
        }

        options_result = serializer_options.object

        for key in key_map:
            if key in options_result:
                UserOption.objects.set_value(
                    user=user,
                    key=key_map.get(key, key),
                    value=options_result.get(key),
                )

        user = serializer.save()

        return Response(serialize(user, request.user, DetailedUserSerializer()))

    @sudo_required
    def delete(self, request, user):
        """
        Delete User Account

        Also removes organizations if they are an owner
        :pparam string user_id: user id
        :param list organizations: List of organization ids to remove
        :auth required:
        """

        serializer = OrganizationsSerializer(data=request.DATA)

        if not serializer.is_valid():
            return Response(status=status.HTTP_400_BAD_REQUEST)

        # from `frontend/remove_account.py`
        org_list = Organization.objects.filter(
            member_set__role__in=[x.id for x in roles.with_scope('org:admin')],
            member_set__user=user,
            status=OrganizationStatus.VISIBLE,
        )

        org_results = []
        for org in org_list:
            org_results.append({
                'organization': org,
                'single_owner': org.has_single_owner(),
            })

        avail_org_slugs = set([o['organization'].slug for o in org_results])
        orgs_to_remove = set(serializer.object.get('organizations')).intersection(avail_org_slugs)

        for result in org_results:
            if result['single_owner']:
                orgs_to_remove.add(result['organization'].slug)

        delete_logger.info(
            'user.deactivate',
            extra={
                'actor_id': request.user.id,
                'ip_address': request.META['REMOTE_ADDR'],
            }
        )

        for org_slug in orgs_to_remove:
            client.delete(
                path='/organizations/{}/'.format(org_slug),
                request=request,
                is_sudo=True)

        remaining_org_ids = [
            o.id for o in org_list if o.slug in avail_org_slugs.difference(orgs_to_remove)
        ]

        if remaining_org_ids:
            OrganizationMember.objects.filter(
                organization__in=remaining_org_ids,
                user=request.user,
            ).delete()

        User.objects.filter(
            id=request.user.id,
        ).update(
            is_active=False,
        )

        logout(request)

        return Response(status=status.HTTP_204_NO_CONTENT)
