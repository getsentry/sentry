from __future__ import absolute_import

import logging

from sentry.models import ProjectOwnership, User

from sentry.utils import metrics
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


class MailAdapter(object):
    """
    This class contains generic logic for notifying users via Email. Short term we'll
    logic into this class from `MailPlugin` and have `MailPlugin` use the Adapter.
    Once this is complete, we'll update logic in here to handle more cases for mail,
    and eventually deprecate `MailPlugin` entirely.
    """

    alert_option_key = "mail:alert"

    def get_sendable_users(self, project):
        """
        Return a collection of user IDs that are eligible to receive
        notifications for the provided project.
        """
        return project.get_notification_recipients(self.alert_option_key)

    def get_send_to(self, project, event=None):
        """
        Returns a list of user IDs for the users that should receive
        notifications for the provided project.

        This result may come from cached data.
        """
        if not (project and project.teams.exists()):
            logger.debug("Tried to send notification to invalid project: %r", project)
            return []

        if event:
            owners, _ = ProjectOwnership.get_owners(project.id, event.data)
            if owners != ProjectOwnership.Everyone:
                if not owners:
                    metrics.incr(
                        "features.owners.send_to",
                        tags={"organization": project.organization_id, "outcome": "empty"},
                        skip_internal=True,
                    )
                    return []

                metrics.incr(
                    "features.owners.send_to",
                    tags={"organization": project.organization_id, "outcome": "match"},
                    skip_internal=True,
                )
                send_to_list = set()
                teams_to_resolve = set()
                for owner in owners:
                    if owner.type == User:
                        send_to_list.add(owner.id)
                    else:
                        teams_to_resolve.add(owner.id)

                # get all users in teams
                if teams_to_resolve:
                    send_to_list |= set(
                        User.objects.filter(
                            is_active=True,
                            sentry_orgmember_set__organizationmemberteam__team__id__in=teams_to_resolve,
                        ).values_list("id", flat=True)
                    )

                alert_settings = project.get_member_alert_settings(self.alert_option_key)
                disabled_users = set(
                    user for user, setting in alert_settings.items() if setting == 0
                )
                return send_to_list - disabled_users
            else:
                metrics.incr(
                    "features.owners.send_to",
                    tags={"organization": project.organization_id, "outcome": "everyone"},
                    skip_internal=True,
                )

        cache_key = "mail:send_to:{}".format(project.pk)
        send_to_list = cache.get(cache_key)
        if send_to_list is None:
            send_to_list = [s for s in self.get_sendable_users(project) if s]
            cache.set(cache_key, send_to_list, 60)  # 1 minute cache

        return send_to_list
