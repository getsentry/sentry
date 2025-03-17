from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING, NotRequired, TypedDict

from django.conf import settings
from django.http.response import HttpResponseBase
from django.urls import re_path, reverse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.plugin import PluginSerializer

# api compat
from sentry.exceptions import PluginError  # NOQA
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.groupmeta import GroupMeta
from sentry.plugins.base.v1 import Plugin
from sentry.types.activity import ActivityType
from sentry.users.services.usersocialauth.model import RpcUserSocialAuth
from sentry.users.services.usersocialauth.service import usersocialauth_service
from sentry.utils.auth import get_auth_providers
from sentry.utils.http import absolute_uri
from sentry.utils.safe import safe_execute

if TYPE_CHECKING:
    from django.utils.functional import _StrPromise


@region_silo_endpoint
class PluginGroupEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    view: Callable[[Request, Group], HttpResponseBase] = None  # type: ignore[assignment]  # populated by .as_view

    def _handle(self, request: Request, group, *args, **kwargs):
        GroupMeta.objects.populate_cache([group])

        return self.view(request, group, *args, **kwargs)

    def get(self, request: Request, group, *args, **kwargs) -> Response:
        return self._handle(request, group, *args, **kwargs)

    def post(self, request: Request, group, *args, **kwargs) -> Response:
        return self._handle(request, group, *args, **kwargs)

    def respond(self, *args, **kwargs):
        return Response(*args, **kwargs)


class _PluginIssueIssue(TypedDict):
    issue_id: int
    url: str
    label: str


class _PluginIssue(TypedDict):
    slug: str
    allowed_actions: tuple[str, ...]
    title: str | _StrPromise
    issue: NotRequired[_PluginIssueIssue]


# TODO(dcramer): remove this in favor of GroupEndpoint
@region_silo_endpoint
class IssueGroupActionEndpoint(PluginGroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    view_method_name: str = None  # type: ignore[assignment]  # populated by .as_view
    plugin: IssuePlugin2 = None  # type: ignore[assignment]  # populated by .as_view

    def _handle(self, request: Request, group, *args, **kwargs):
        GroupMeta.objects.populate_cache([group])

        return getattr(self.plugin, self.view_method_name)(request, group, *args, **kwargs)


class IssueTrackingPlugin2(Plugin):
    auth_provider: str | None = None

    allowed_actions = ("create", "link", "unlink")

    # we default this to None to support legacy integrations, but newer style
    # should explicitly call out what is stored
    issue_fields: frozenset[str] | None = None
    # issue_fields = frozenset(['id', 'title', 'url'])

    def get_plugin_type(self):
        return "issue-tracking"

    def has_project_conf(self):
        return True

    def get_group_body(self, group, event, **kwargs):
        result = []
        for interface in event.interfaces.values():
            output = safe_execute(interface.to_string, event)
            if output:
                result.append(output)
        return "\n\n".join(result)

    def get_group_description(self, group, event):
        referrer = self.get_conf_key() + "_plugin"
        output = [absolute_uri(group.get_absolute_url(params={"referrer": referrer}))]
        body = self.get_group_body(group, event)
        if body:
            output.extend(["", "```", body, "```"])
        return "\n".join(output)

    def get_group_title(self, group, event):
        return event.title

    def is_configured(self, project) -> bool:
        raise NotImplementedError

    def get_group_urls(self):
        _urls = []
        for action in self.allowed_actions:
            view_method_name = "view_%s" % action
            _urls.append(
                re_path(
                    r"^%s/" % action,
                    PluginGroupEndpoint.as_view(view=getattr(self, view_method_name)),
                )
            )
        return _urls

    def get_auth_for_user(self, user, **kwargs) -> RpcUserSocialAuth | None:
        """
        Return a ``RpcUserSocialAuth`` object for the given user based on this plugins ``auth_provider``.
        """
        assert self.auth_provider, "There is no auth provider configured for this plugin."

        if not user.is_authenticated:
            return None

        return usersocialauth_service.get_one_or_none(
            filter={"user_id": user.id, "provider": self.auth_provider}
        )

    def needs_auth(self, request: Request, project, **kwargs):
        """
        Return ``True`` if the authenticated user needs to associate an auth service before
        performing actions with this plugin.
        """
        if self.auth_provider is None:
            return False

        if not request.user.is_authenticated:
            return True

        auth = usersocialauth_service.get_one_or_none(
            filter={"user_id": request.user.id, "provider": self.auth_provider}
        )
        return not bool(auth)

    def get_new_issue_fields(self, request: Request, group, event, **kwargs):
        """
        If overriding, supported properties include 'readonly': true
        """
        return [
            {
                "name": "title",
                "label": "Title",
                "default": self.get_group_title(group, event),
                "type": "text",
            },
            {
                "name": "description",
                "label": "Description",
                "default": self.get_group_description(group, event),
                "type": "textarea",
            },
        ]

    def get_link_existing_issue_fields(self, request: Request, group, event, **kwargs):
        return []

    def get_issue_url(self, group, issue_id: str) -> str:
        """
        Given an issue context (issue_id string) return an absolute URL to the issue's details
        page.
        """
        raise NotImplementedError

    def get_issue_label(self, group, issue_id: str) -> str:
        """
        Given an issue context (issue_id string) return a string representing the issue.

        e.g. GitHub represents issues as GH-XXX
        """
        return f"#{issue_id}"

    def create_issue(self, request: Request, group, form_data):
        """
        Creates the issue on the remote service and returns an issue ID.

        Returns ``{'id': '1', 'title': issue_title}``
        """
        raise NotImplementedError

    def link_issue(self, request: Request, group, form_data, **kwargs):
        """
        Can be overridden for any actions needed when linking issues
        (like adding a comment to an existing issue).

        Returns ``{'id': '1', 'title': issue_title}``
        """

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
                    errors[field["name"]] = "%s is a required field." % field["label"]
        return errors

    def get_issue_field_map(self):
        # XXX(dcramer): legacy support
        conf_key = self.get_conf_key()
        if self.issue_fields is None:
            return {"id": f"{conf_key}:tid"}
        return {key: f"{conf_key}:issue_{key}" for key in self.issue_fields}

    def build_issue(self, group):
        issue_field_map = self.get_issue_field_map()
        issue = {}
        for key, meta_name in issue_field_map.items():
            issue[key] = GroupMeta.objects.get_value(group, meta_name, None)
        if not any(issue.values()):
            return None
        return issue

    def has_linked_issue(self, group):
        return bool(self.build_issue(group))

    def unlink_issue(self, request: Request, group, issue, **kwargs):
        issue_field_map = self.get_issue_field_map()
        for meta_name in issue_field_map.values():
            GroupMeta.objects.unset_value(group, meta_name)
        return self.redirect(group.get_absolute_url())

    def view_create(self, request: Request, group, **kwargs):
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
        for key, meta_name in issue_field_map.items():
            if key in issue:
                GroupMeta.objects.set_value(group, meta_name, issue[key])
            else:
                GroupMeta.objects.unset_value(group, meta_name)

        issue_information = {
            "title": issue.get("title")
            or request.data.get("title")
            or self._get_issue_label_compat(group, issue),
            "provider": self.get_title(),
            "location": self.get_issue_url(group, issue["id"]),
            "label": self.get_issue_label(group, issue["id"]),
        }
        Activity.objects.create(
            project=group.project,
            group=group,
            type=ActivityType.CREATE_ISSUE.value,
            user_id=request.user.id,
            data=issue_information,
        )

        analytics.record(
            "issue_tracker.used",
            user_id=request.user.id,
            default_user_id=group.project.organization.get_default_owner().id,
            organization_id=group.project.organization_id,
            project_id=group.project.id,
            issue_tracker=self.slug,
        )

        return Response(
            {
                "issue_url": self.get_issue_url(group, issue["id"]),
                "link": self.get_issue_url(group, issue["id"]),
                "label": self.get_issue_label(group, issue["id"]),
                "id": issue["id"],
            }
        )

    def view_link(self, request: Request, group, **kwargs):
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
        for key, meta_name in issue_field_map.items():
            if key in issue:
                GroupMeta.objects.set_value(group, meta_name, issue[key])
            else:
                GroupMeta.objects.unset_value(group, meta_name)

        issue_information = {
            "title": issue.get("title") or self._get_issue_label_compat(group, issue),
            "provider": self.get_title(),
            "location": self.get_issue_url(group, issue["id"]),
            "label": self.get_issue_label(group, issue["id"]),
        }
        Activity.objects.create(
            project=group.project,
            group=group,
            type=ActivityType.CREATE_ISSUE.value,
            user_id=request.user.id,
            data=issue_information,
        )
        return Response(
            {
                "message": "Successfully linked issue.",
                "link": self.get_issue_url(group, issue["id"]),
                "label": self.get_issue_label(group, issue["id"]),
                "id": issue["id"],
            }
        )

    def view_unlink(self, request: Request, group, **kwargs):
        auth_errors = self.check_config_and_auth(request, group)
        if auth_errors:
            return Response(auth_errors, status=400)
        issue = self.build_issue(group)
        if issue and "unlink" in self.allowed_actions:
            self.unlink_issue(request, group, issue)
            return Response({"message": "Successfully unlinked issue."})
        return Response({"message": "No issues to unlink."}, status=400)

    def plugin_issues(self, group, plugin_issues, **kwargs) -> None:
        if not self.is_configured(project=group.project):
            return

        item: _PluginIssue = {
            "slug": self.slug,
            "allowed_actions": self.allowed_actions,
            "title": self.get_title(),
        }
        issue = self.build_issue(group)
        if issue:
            item["issue"] = {
                "issue_id": issue.get("id"),
                "url": self.get_issue_url(group, issue["id"]),
                "label": self.get_issue_label(group, issue["id"]),
            }

        item.update(serialize(self, serializer=PluginSerializer(group.project)))
        plugin_issues.append(item)

    def get_config(self, project, user=None, initial=None, add_additional_fields: bool = False):
        # TODO(dcramer): update existing plugins to just use get_config
        return self.get_configure_plugin_fields(
            project=project, user=user, initial=initial, add_additional_fields=add_additional_fields
        )

    def check_config_and_auth(self, request: Request, group):
        has_auth_configured = self.has_auth_configured()
        if not (has_auth_configured and self.is_configured(project=group.project)):
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
                "auth_url": absolute_uri(
                    reverse("socialauth_associate", args=[self.auth_provider])
                ),
            }

    # TODO: should we get rid of this (move it to react?)
    def tags(self, request: Request, group, tag_list, **kwargs):
        if not self.is_configured(project=group.project):
            return tag_list

        issue = self.build_issue(group)
        if not issue:
            return tag_list

        tag_list.append(
            {
                "url": self.get_issue_url(group, issue["id"]),
                "displayName": self.get_issue_label(group, issue["id"]),
            }
        )

        return tag_list


IssuePlugin2 = IssueTrackingPlugin2
