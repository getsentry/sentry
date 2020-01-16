from __future__ import absolute_import

import six

from rest_framework.response import Response
from social_auth.models import UserSocialAuth

from django.conf import settings
from django.conf.urls import url
from django.core.urlresolvers import reverse
from django.utils.html import format_html

from sentry.api.serializers.models.plugin import PluginSerializer

# api compat
from sentry.exceptions import PluginError  # NOQA
from sentry.models import Activity, GroupMeta
from sentry.plugins.base.v1 import Plugin
from sentry.plugins.base.configuration import react_plugin_config
from sentry.plugins.endpoints import PluginGroupEndpoint
from sentry.signals import issue_tracker_used
from sentry.utils.auth import get_auth_providers
from sentry.utils.http import absolute_uri
from sentry.utils.safe import safe_execute


# TODO(dcramer): remove this in favor of GroupEndpoint
class IssueGroupActionEndpoint(PluginGroupEndpoint):
    view_method_name = None
    plugin = None

    def _handle(self, request, group, *args, **kwargs):
        GroupMeta.objects.populate_cache([group])

        return getattr(self.plugin, self.view_method_name)(request, group, *args, **kwargs)


class IssueTrackingPlugin2(Plugin):
    auth_provider = None

    allowed_actions = ("create", "link", "unlink")

    # we default this to None to support legacy integrations, but newer style
    # should explicitly call out what is stored
    issue_fields = None
    # issue_fields = frozenset(['id', 'title', 'url'])

    def configure(self, project, request):
        return react_plugin_config(self, project, request)

    def get_plugin_type(self):
        return "issue-tracking"

    def has_project_conf(self):
        return True

    def get_group_body(self, request, group, event, **kwargs):
        result = []
        for interface in six.itervalues(event.interfaces):
            output = safe_execute(interface.to_string, event, _with_transaction=False)
            if output:
                result.append(output)
        return "\n\n".join(result)

    def get_group_description(self, request, group, event):
        referrer = self.get_conf_key() + "_plugin"
        output = [absolute_uri(group.get_absolute_url(params={"referrer": referrer}))]
        body = self.get_group_body(request, group, event)
        if body:
            output.extend(["", "```", body, "```"])
        return "\n".join(output)

    def get_group_title(self, request, group, event):
        return event.title

    def is_configured(self, request, project, **kwargs):
        raise NotImplementedError

    def get_group_urls(self):
        _urls = []
        for action in self.allowed_actions:
            view_method_name = "view_%s" % action
            _urls.append(
                url(
                    r"^%s/" % action,
                    PluginGroupEndpoint.as_view(view=getattr(self, view_method_name)),
                )
            )
        return _urls

    def get_auth_for_user(self, user, **kwargs):
        """
        Return a ``UserSocialAuth`` object for the given user based on this plugins ``auth_provider``.
        """
        assert self.auth_provider, "There is no auth provider configured for this plugin."

        if not user.is_authenticated():
            return None

        try:
            return UserSocialAuth.objects.filter(user=user, provider=self.auth_provider)[0]
        except IndexError:
            return None

    def needs_auth(self, request, project, **kwargs):
        """
        Return ``True`` if the authenticated user needs to associate an auth service before
        performing actions with this plugin.
        """
        if self.auth_provider is None:
            return False

        if not request.user.is_authenticated():
            return True

        return not UserSocialAuth.objects.filter(
            user=request.user, provider=self.auth_provider
        ).exists()

    def get_new_issue_fields(self, request, group, event, **kwargs):
        """
        If overriding, supported properties include 'readonly': true
        """
        return [
            {
                "name": "title",
                "label": "Title",
                "default": self.get_group_title(request, group, event),
                "type": "text",
            },
            {
                "name": "description",
                "label": "Description",
                "default": self.get_group_description(request, group, event),
                "type": "textarea",
            },
        ]

    def get_link_existing_issue_fields(self, request, group, event, **kwargs):
        return []

    def _get_issue_url_compat(self, group, issue, **kwargs):
        if self.issue_fields is None:
            return self.get_issue_url(group, issue["id"])
        return self.get_issue_url(group, issue)

    def _get_issue_label_compat(self, group, issue, **kwargs):
        if self.issue_fields is None:
            return self.get_issue_label(group, issue["id"])
        return self.get_issue_label(group, issue)

    def get_issue_url(self, group, issue, **kwargs):
        """
        Given an issue context (issue_id string or issue dict) return an absolute URL to the issue's details
        page.
        """
        raise NotImplementedError

    def get_issue_label(self, group, issue, **kwargs):
        """
        Given an issue context (issue_id string or issue dict) return a string representing the issue.

        e.g. GitHub represents issues as GH-XXX
        """
        if isinstance(issue, dict):
            return u"#{}".format(issue["id"])
        return u"#{}".format(issue)

    def create_issue(self, request, group, form_data, **kwargs):
        """
        Creates the issue on the remote service and returns an issue ID.

        Returns ``{'id': '1', 'title': issue_title}``
        """
        raise NotImplementedError

    def link_issue(self, request, group, form_data, **kwargs):
        """
        Can be overridden for any actions needed when linking issues
        (like adding a comment to an existing issue).

        Returns ``{'id': '1', 'title': issue_title}``
        """
        pass

    def has_auth_configured(self, **kwargs):
        if not self.auth_provider:
            return True

        return self.auth_provider in get_auth_providers()

    def validate_form(self, fields, form_data):
        errors = {}
        for field in fields:
            if field.get("required", True) and not field.get("readonly"):
                value = form_data.get(field["name"])
                if value is None or value == "":
                    errors[field["name"]] = u"%s is a required field." % field["label"]
        return errors

    def get_issue_field_map(self):
        # XXX(dcramer): legacy support
        conf_key = self.get_conf_key()
        if self.issue_fields is None:
            return {"id": u"{}:tid".format(conf_key)}
        return {key: u"{}:issue_{}".format(conf_key, key) for key in self.issue_fields}

    def build_issue(self, group):
        issue_field_map = self.get_issue_field_map()
        issue = {}
        for key, meta_name in six.iteritems(issue_field_map):
            issue[key] = GroupMeta.objects.get_value(group, meta_name, None)
        if not any(issue.values()):
            return None
        return issue

    def has_linked_issue(self, group):
        return bool(self.build_issue(group))

    def unlink_issue(self, request, group, issue, **kwargs):
        issue_field_map = self.get_issue_field_map()
        for meta_name in six.itervalues(issue_field_map):
            GroupMeta.objects.unset_value(group, meta_name)
        return self.redirect(group.get_absolute_url())

    def view_create(self, request, group, **kwargs):
        auth_errors = self.check_config_and_auth(request, group)
        if auth_errors:
            return Response(auth_errors, status=400)

        event = group.get_latest_event()
        if event is None:
            return Response(
                {
                    "message": "Unable to create issues: there are "
                    "no events associated with this group"
                },
                status=400,
            )
        try:
            fields = self.get_new_issue_fields(request, group, event, **kwargs)
        except Exception as e:
            return self.handle_api_error(e)
        if request.method == "GET":
            return Response(fields)

        errors = self.validate_form(fields, request.data)
        if errors:
            return Response({"error_type": "validation", "errors": errors}, status=400)

        try:
            issue = self.create_issue(group=group, form_data=request.data, request=request)
        except Exception as e:
            return self.handle_api_error(e)

        if not isinstance(issue, dict):
            issue = {"id": issue}

        issue_field_map = self.get_issue_field_map()
        for key, meta_name in six.iteritems(issue_field_map):
            if key in issue:
                GroupMeta.objects.set_value(group, meta_name, issue[key])
            else:
                GroupMeta.objects.unset_value(group, meta_name)

        issue_information = {
            "title": issue.get("title")
            or request.data.get("title")
            or self._get_issue_label_compat(group, issue),
            "provider": self.get_title(),
            "location": self._get_issue_url_compat(group, issue),
            "label": self._get_issue_label_compat(group, issue),
        }
        Activity.objects.create(
            project=group.project,
            group=group,
            type=Activity.CREATE_ISSUE,
            user=request.user,
            data=issue_information,
        )

        issue_tracker_used.send_robust(
            plugin=self, project=group.project, user=request.user, sender=type(self)
        )
        return Response(
            {
                "issue_url": self.get_issue_url(group, issue),
                "link": self._get_issue_url_compat(group, issue),
                "label": self._get_issue_label_compat(group, issue),
                "id": issue["id"],
            }
        )

    def view_link(self, request, group, **kwargs):
        auth_errors = self.check_config_and_auth(request, group)
        if auth_errors:
            return Response(auth_errors, status=400)

        event = group.get_latest_event()
        if event is None:
            return Response(
                {
                    "message": "Unable to create issues: there are "
                    "no events associated with this group"
                },
                status=400,
            )

        try:
            fields = self.get_link_existing_issue_fields(request, group, event, **kwargs)
        except Exception as e:
            return self.handle_api_error(e)
        if request.method == "GET":
            return Response(fields)
        errors = self.validate_form(fields, request.data)
        if errors:
            return Response({"error_type": "validation", "errors": errors}, status=400)

        try:
            issue = self.link_issue(group=group, form_data=request.data, request=request) or {}
        except Exception as e:
            return self.handle_api_error(e)

        # HACK(dcramer): maintain data for legacy issues
        if "id" not in issue and "issue_id" in request.data:
            issue["id"] = request.data["issue_id"]

        issue_field_map = self.get_issue_field_map()
        for key, meta_name in six.iteritems(issue_field_map):
            if key in issue:
                GroupMeta.objects.set_value(group, meta_name, issue[key])
            else:
                GroupMeta.objects.unset_value(group, meta_name)

        issue_information = {
            "title": issue.get("title") or self._get_issue_label_compat(group, issue),
            "provider": self.get_title(),
            "location": self._get_issue_url_compat(group, issue),
            "label": self._get_issue_label_compat(group, issue),
        }
        Activity.objects.create(
            project=group.project,
            group=group,
            type=Activity.CREATE_ISSUE,
            user=request.user,
            data=issue_information,
        )
        return Response(
            {
                "message": "Successfully linked issue.",
                "link": self._get_issue_url_compat(group, issue),
                "label": self._get_issue_label_compat(group, issue),
                "id": issue["id"],
            }
        )

    def view_unlink(self, request, group, **kwargs):
        auth_errors = self.check_config_and_auth(request, group)
        if auth_errors:
            return Response(auth_errors, status=400)
        issue = self.build_issue(group)
        if issue and "unlink" in self.allowed_actions:
            self.unlink_issue(request, group, issue)
            return Response({"message": "Successfully unlinked issue."})
        return Response({"message": "No issues to unlink."}, status=400)

    def plugin_issues(self, request, group, plugin_issues, **kwargs):
        if not self.is_configured(request=request, project=group.project):
            return plugin_issues

        item = {
            "slug": self.slug,
            "allowed_actions": self.allowed_actions,
            "title": self.get_title(),
        }
        issue = self.build_issue(group)
        if issue:
            item["issue"] = {
                "issue_id": issue.get("id"),
                "url": self._get_issue_url_compat(group, issue),
                "label": self._get_issue_label_compat(group, issue),
            }

        item.update(PluginSerializer(group.project).serialize(self, None, request.user))
        plugin_issues.append(item)
        return plugin_issues

    def get_config(self, *args, **kwargs):
        # TODO(dcramer): update existing plugins to just use get_config
        # TODO(dcramer): remove request kwarg after sentry-plugins has been
        # updated
        kwargs.setdefault("request", None)
        return self.get_configure_plugin_fields(*args, **kwargs)

    def check_config_and_auth(self, request, group):
        has_auth_configured = self.has_auth_configured()
        if not (has_auth_configured and self.is_configured(project=group.project, request=request)):
            if self.auth_provider:
                required_auth_settings = settings.AUTH_PROVIDERS[self.auth_provider]
            else:
                required_auth_settings = None

            return {
                "error_type": "config",
                "has_auth_configured": has_auth_configured,
                "auth_provider": self.auth_provider,
                "required_auth_settings": required_auth_settings,
            }

        if self.needs_auth(project=group.project, request=request):
            return {
                "error_type": "auth",
                "auth_url": reverse("socialauth_associate", args=[self.auth_provider]),
            }

    # TODO: should we get rid of this (move it to react?)
    def tags(self, request, group, tag_list, **kwargs):
        if not self.is_configured(request=request, project=group.project):
            return tag_list

        issue = self.build_issue(group)
        if not issue:
            return tag_list

        tag_list.append(
            format_html(
                '<a href="{}">{}</a>',
                self._get_issue_url_compat(group, issue),
                self._get_issue_label_compat(group, issue),
            )
        )

        return tag_list


IssuePlugin2 = IssueTrackingPlugin2
