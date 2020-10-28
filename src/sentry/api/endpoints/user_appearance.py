from __future__ import absolute_import

from datetime import datetime

import pytz
from django.conf import settings
from rest_framework.response import Response
from rest_framework import serializers
from django.utils.translation import ugettext_lazy as _

from sentry.api.bases.user import UserEndpoint
from sentry.constants import LANGUAGES
from sentry.models import UserOption


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


class UserAppearanceSerializer(serializers.Serializer):
    # Note the label part of these ChoiceFields are not used by the frontend
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


class UserAppearanceEndpoint(UserEndpoint):
    def get(self, request, user):
        """
        Retrieve Account "Appearance" options
        `````````````````````````````````````

        Return details for an account's appearance options such as: timezone, 24hr times, language,
        stacktrace_order.

        :auth: required
        """
        options = UserOption.objects.get_all_values(user=user, project=None)

        return Response(
            {
                "language": options.get("language") or request.LANGUAGE_CODE,
                "stacktraceOrder": int(options.get("stacktrace_order", -1) or -1),
                "timezone": options.get("timezone") or settings.SENTRY_DEFAULT_TIME_ZONE,
                "clock24Hours": options.get("clock_24_hours") or False,
            }
        )

    def put(self, request, user):
        """
        Update Account Appearance options
        `````````````````````````````````

        Update account appearance options. Only supplied values are updated.

        :param string language: language preference
        :param string stacktrace_order: One of -1 (default), 1 (most recent call last), 2 (most recent call first).
        :param string timezone: timezone option
        :param clock_24_hours boolean: use 24 hour clock
        :auth: required
        """
        serializer = UserAppearanceSerializer(data=request.data, partial=True)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data

        # map API keys to keys in model
        key_map = {"stacktraceOrder": "stacktrace_order", "clock24Hours": "clock_24_hours"}

        for key in result:
            UserOption.objects.set_value(
                user=user, key=key_map.get(key, key), value=result.get(key)
            )

        return Response(status=204)
