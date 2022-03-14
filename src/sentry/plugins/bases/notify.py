import logging
from typing import Set
from urllib.error import HTTPError as UrllibHTTPError
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from django import forms
from requests.exceptions import HTTPError, SSLError

from sentry import digests, ratelimits
from sentry.exceptions import InvalidIdentity, PluginError
from sentry.models import NotificationSetting
from sentry.plugins.base import Notification, Plugin
from sentry.plugins.base.configuration import react_plugin_config
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.integrations import ExternalProviders


class NotificationConfigurationForm(forms.Form):
    pass


class BaseNotificationUserOptionsForm(forms.Form):
    def __init__(self, plugin, user, *args, **kwargs):
        self.plugin = plugin
        self.user = user
        super().__init__(*args, **kwargs)

    def get_title(self):
        return self.plugin.get_conf_title()

    def get_description(self):
        return ""

    def save(self):
        raise NotImplementedError


class NotificationPlugin(Plugin):
    slug = ""
    description = (
        "Notify project members when a new event is seen for the first time, or when an "
        "already resolved event has changed back to unresolved."
    )
    # site_conf_form = NotificationConfigurationForm
    project_conf_form = NotificationConfigurationForm

    def configure(self, project, request):
        return react_plugin_config(self, project, request)

    def get_plugin_type(self):
        return "notification"

    def notify(self, notification, raise_exception=False):
        """
        This calls the notify_users method of the plugin.
        Normally this method eats the error and logs it but if we
        set raise_exception=True like we do for the test plugin button,
        the exception is raised
        """
        event = notification.event
        try:
            return self.notify_users(
                event.group, event, triggering_rules=[r.label for r in notification.rules]
            )
        except (
            ApiError,
            HTTPError,
            InvalidIdentity,
            PluginError,
            SSLError,
            UrllibHTTPError,
        ) as err:
            self.logger.info(
                "notification-plugin.notify-failed",
                extra={
                    "error": str(err),
                    "plugin": self.slug,
                    "project_id": event.group.project_id,
                    "organization_id": event.group.project.organization_id,
                },
            )
            if raise_exception:
                raise err
            return False

    def rule_notify(self, event, futures):
        rules = []
        extra = {"event_id": event.event_id, "group_id": event.group_id, "plugin": self.slug}
        log_event = "dispatched"
        for future in futures:
            rules.append(future.rule)
            extra["rule_id"] = future.rule.id
            if not future.kwargs:
                continue
            raise NotImplementedError(
                "The default behavior for notification de-duplication does not support args"
            )

        project = event.group.project
        extra["project_id"] = project.id
        notification = Notification(event=event, rules=rules)
        self.notify(notification)
        self.logger.info("notification.%s" % log_event, extra=extra)

    def notify_users(self, group, event, triggering_rules, fail_silently=False, **kwargs):
        raise NotImplementedError

    def notify_about_activity(self, activity):
        pass

    def get_notification_recipients(self, project, user_option: str) -> Set:
        from sentry.models import UserOption

        alert_settings = {
            o.user_id: int(o.value)
            for o in UserOption.objects.filter(project=project, key=user_option)
        }

        disabled = {u for u, v in alert_settings.items() if v == 0}

        member_set = set(
            project.member_set.exclude(user__in=disabled).values_list("user", flat=True)
        )

        # determine members default settings
        members_to_check = {u for u in member_set if u not in alert_settings}
        if members_to_check:
            disabled = {
                uo.user_id
                for uo in UserOption.objects.filter(
                    key="subscribe_by_default", user__in=members_to_check
                )
                if str(uo.value) == "0"
            }
            member_set = [x for x in member_set if x not in disabled]

        return member_set

    def get_sendable_user_objects(self, project):
        """
        Return a collection of user IDs that are eligible to receive
        notifications for the provided project.
        """
        if self.get_conf_key() == "mail":
            return NotificationSetting.objects.get_notification_recipients(project)[
                ExternalProviders.EMAIL
            ]

        return self.get_notification_recipients(project, f"{self.get_conf_key()}:alert")

    def __is_rate_limited(self, group, event):
        return ratelimits.is_limited(project=group.project, key=self.get_conf_key(), limit=10)

    def is_configured(self, project):
        raise NotImplementedError

    def should_notify(self, group, event):
        project = event.project
        if not self.is_configured(project=project):
            return False

        # If the plugin doesn't support digests or they are not enabled,
        # perform rate limit checks to support backwards compatibility with
        # older plugins.
        if not (
            hasattr(self, "notify_digest") and digests.enabled(project)
        ) and self.__is_rate_limited(group, event):
            logger = logging.getLogger(f"sentry.plugins.{self.get_conf_key()}")
            logger.info("notification.rate_limited", extra={"project_id": project.id})
            return False

        return True

    def test_configuration(self, project):
        from sentry.utils.samples import create_sample_event

        event = create_sample_event(project, platform="python")
        notification = Notification(event=event)
        return self.notify(notification, raise_exception=True)

    def test_configuration_and_get_test_results(self, project):
        try:
            test_results = self.test_configuration(project)
        except Exception as exc:
            if isinstance(exc, HTTPError) and hasattr(exc.response, "text"):
                test_results = f"{exc}\n{exc.response.text[:256]}"
            elif hasattr(exc, "read") and callable(exc.read):
                test_results = f"{exc}\n{exc.read()[:256]}"
            else:
                logging.exception("Plugin(%s) raised an error during test, %s", self.slug, str(exc))
                if str(exc).lower().startswith("error communicating with"):
                    test_results = str(exc)[:256]
                else:
                    test_results = (
                        "There was an internal error with the Plugin, %s" % str(exc)[:256]
                    )
        if not test_results:
            test_results = "No errors returned"
        return test_results

    def get_notification_doc_html(self, **kwargs):
        return ""

    def add_notification_referrer_param(self, url):
        if self.slug:
            parsed_url = urlparse(url)
            query = parse_qs(parsed_url.query)
            query["referrer"] = self.slug

            url_list = list(parsed_url)
            url_list[4] = urlencode(query, doseq=True)
            return urlunparse(url_list)

        return url


# Backwards-compatibility
NotifyConfigurationForm = NotificationConfigurationForm
NotifyPlugin = NotificationPlugin
