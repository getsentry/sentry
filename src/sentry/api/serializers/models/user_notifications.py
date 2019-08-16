from __future__ import absolute_import

from collections import defaultdict

from sentry.api.serializers import Serializer
from sentry.models import UserOption


# notification_option_key is one of:
# - mail:alert
# - workflow:notifications
# - deploy-emails
# - reports:disabled-organizations
# - mail:email
class UserNotificationsSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        notification_option_key = kwargs["notification_option_key"]
        filter_args = {}

        if notification_option_key in ["alerts", "workflow", "email"]:
            filter_args["project__isnull"] = False
        elif notification_option_key == "deploy":
            filter_args["organization__isnull"] = False

        data = list(
            UserOption.objects.filter(
                key=notification_option_key, user__in=item_list, **filter_args
            ).select_related("user", "project", "organization")
        )

        results = defaultdict(list)

        for uo in data:
            results[uo.user].append(uo)

        return results

    def serialize(self, obj, attrs, user, **kwargs):
        notification_option_key = kwargs["notification_option_key"]
        data = {}

        for uo in attrs:
            if notification_option_key == "reports:disabled-organizations":
                # UserOption for key=reports:disabled-organizations saves a list of orgIds
                # that should not receive reports
                # This UserOption should have both project + organization = None
                for org_id in uo.value:
                    data[org_id] = 0
            elif uo.project is not None:
                data[uo.project.id] = uo.value
            elif uo.organization is not None:
                data[uo.organization.id] = uo.value
        return data
