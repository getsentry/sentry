from collections import defaultdict

from sentry.api.serializers import Serializer
from sentry.models import UserOption
from sentry.notifications.legacy_mappings import get_legacy_key_from_fine_tuning_key
from sentry.notifications.types import FineTuningAPIKey


class UserNotificationsSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        notification_type = kwargs["notification_type"]

        filter_args = {}
        if notification_type in [
            FineTuningAPIKey.ALERTS,
            FineTuningAPIKey.EMAIL,
            FineTuningAPIKey.WORKFLOW,
        ]:
            filter_args["project__isnull"] = False
        elif notification_type == FineTuningAPIKey.DEPLOY:
            filter_args["organization__isnull"] = False

        data = list(
            UserOption.objects.filter(
                key=get_legacy_key_from_fine_tuning_key(notification_type),
                user__in=item_list,
                **filter_args,
            ).select_related("user", "project", "organization")
        )

        results = defaultdict(list)

        for uo in data:
            results[uo.user].append(uo)

        return results

    def serialize(self, obj, attrs, user, **kwargs):
        notification_type = kwargs["notification_type"]
        data = {}

        for uo in attrs:
            if notification_type == FineTuningAPIKey.REPORTS:
                # UserOption for key=reports:disabled-organizations saves a list of orgIds
                # that should not receive reports
                # This UserOption should have both project + organization = None
                for org_id in uo.value:
                    data[org_id] = "0"
            elif uo.project is not None:
                data[uo.project.id] = str(uo.value)
            elif uo.organization is not None:
                data[uo.organization.id] = str(uo.value)
        return data
