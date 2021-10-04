import enum
import logging
from collections import defaultdict
from typing import Any, Mapping, Optional

from sentry.integrations.utils import where_should_sync
from sentry.models import ExternalIssue, GroupLink, User
from sentry.models.useroption import UserOption
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.tasks.integrations import sync_status_inbound as sync_status_inbound_task
from sentry.utils.compat import filter
from sentry.utils.http import absolute_uri
from sentry.utils.safe import safe_execute

logger = logging.getLogger("sentry.integrations.issues")


class ResolveSyncAction(enum.Enum):
    """
    When an issue's state changes, we may have to sync the state based on the
    "done" states we get from the API. This enum encapsulates the three options
    we have: "resolve", "unresolve", or "do nothing".
    """

    NOOP = 0
    RESOLVE = 1
    UNRESOLVE = 2

    @classmethod
    def from_resolve_unresolve(
        cls, should_resolve: bool, should_unresolve: bool
    ) -> "ResolveSyncAction":
        if should_resolve and should_unresolve:
            logger.warning("sync-config-conflict")
            return ResolveSyncAction.NOOP

        if should_resolve:
            return ResolveSyncAction.RESOLVE

        if should_unresolve:
            return ResolveSyncAction.UNRESOLVE

        return ResolveSyncAction.NOOP


class IssueBasicMixin:
    def should_sync(self, attribute):
        return False

    def get_group_title(self, group, event, **kwargs):
        return event.title

    def get_issue_url(self, key):
        """
        Given the key of the external_issue return the external issue link.
        """
        raise NotImplementedError

    def get_group_body(self, group, event, **kwargs):
        result = []
        for interface in event.interfaces.values():
            output = safe_execute(interface.to_string, event, _with_transaction=False)
            if output:
                result.append(output)
        return "\n\n".join(result)

    def get_group_description(self, group, event, **kwargs):
        params = {}
        if kwargs.get("link_referrer"):
            params["referrer"] = kwargs.get("link_referrer")
        output = [
            "Sentry Issue: [{}]({})".format(
                group.qualified_short_id, absolute_uri(group.get_absolute_url(params=params))
            )
        ]
        body = self.get_group_body(group, event)
        if body:
            output.extend(["", "```", body, "```"])
        return "\n".join(output)

    def get_create_issue_config(self, group, user, **kwargs):
        """
        These fields are used to render a form for the user,
        and are then passed in the format of:

        >>>{'title': 'TypeError: Object [object Object] has no method "updateFrom"'}

        to `create_issue`, which handles creation of the issue
        in Jira, VSTS, GitHub, etc
        """
        event = group.get_latest_event()

        return [
            {
                "name": "title",
                "label": "Title",
                "default": self.get_group_title(group, event, **kwargs),
                "type": "string",
                "required": True,
            },
            {
                "name": "description",
                "label": "Description",
                "default": self.get_group_description(group, event, **kwargs),
                "type": "textarea",
                "autosize": True,
                "maxRows": 10,
            },
        ]

    def get_link_issue_config(self, group, **kwargs):
        """
        Used by the `GroupIntegrationDetailsEndpoint` to create an
        `ExternalIssue` using title/description obtained from calling
        `get_issue` described below.
        """
        return [{"name": "externalIssue", "label": "Issue", "default": "", "type": "string"}]

    def get_persisted_default_config_fields(self):
        """
        Returns a list of field names that should have their last used values
        persisted on a per-project basis.
        """
        return []

    def get_persisted_user_default_config_fields(self):
        """
        Returns a list of field names that should have their last used values
        persisted on a per-project, per-user basis.
        """
        return []

    def store_issue_last_defaults(self, project, user, data):
        """
        Stores the last used field defaults on a per-project basis. This
        accepts a dict of values that will be filtered to keys returned by
        ``get_persisted_default_config_fields`` which will automatically be
        merged into the associated field config object as the default.

        >>> integ.store_issue_last_defaults(project, user, {'externalProject': 2})

        When the integration is serialized these values will automatically be
        merged into the field configuration objects.

        NOTE: These are currently stored for both link and create issue, no
              differentiation is made between the two field configs.
        """
        persisted_fields = self.get_persisted_default_config_fields()
        if persisted_fields:
            project_defaults = {k: v for k, v in data.items() if k in persisted_fields}
            self.org_integration.config.setdefault("project_issue_defaults", {}).setdefault(
                str(project.id), {}
            ).update(project_defaults)
            self.org_integration.save()

        user_persisted_fields = self.get_persisted_user_default_config_fields()
        if user_persisted_fields:
            user_defaults = {k: v for k, v in data.items() if k in user_persisted_fields}
            user_option_key = dict(user=user, key="issue:defaults", project=project)
            new_user_defaults = UserOption.objects.get_value(default={}, **user_option_key)
            new_user_defaults.setdefault(self.org_integration.integration.provider, {}).update(
                user_defaults
            )
            UserOption.objects.set_value(value=new_user_defaults, **user_option_key)

    def get_defaults(self, project, user):
        project_defaults = self.get_project_defaults(project.id)

        user_option_key = dict(user=user, key="issue:defaults", project=project)
        user_defaults = UserOption.objects.get_value(default={}, **user_option_key).get(
            self.org_integration.integration.provider, {}
        )

        defaults = {}
        defaults.update(project_defaults)
        defaults.update(user_defaults)

        return defaults

    # TODO(saif): Make private and move all usages over to `get_defaults`
    def get_project_defaults(self, project_id):
        return self.org_integration.config.get("project_issue_defaults", {}).get(
            str(project_id), {}
        )

    def create_issue(self, data, **kwargs):
        """
        Create an issue via the provider's API and return the issue key,
        title and description.

        Should also handle API client exceptions and reraise as an
        IntegrationError (using the `message_from_error` helper).

        >>> def create_issue(self, data, **kwargs):
        >>>     resp = self.get_client().create_issue(data)
        >>>     return {
        >>>         'key': resp['id'],
        >>>         'title': resp['title'],
        >>>         'description': resp['description'],
        >>>     }
        """
        raise NotImplementedError

    def get_issue(self, issue_id, **kwargs):
        """
        Get an issue via the provider's API and return the issue key,
        title and description.

        Should also handle API client exceptions and reraise as an
        IntegrationError (using the `message_from_error` helper).

        >>> def get_issue(self, data, **kwargs):
        >>>     resp = self.get_client().get_issue(issue_id)
        >>>     return {
        >>>         'key': resp['id'],
        >>>         'title': resp['title'],
        >>>         'description': resp['description'],
        >>>     }
        """
        raise NotImplementedError

    def after_link_issue(self, external_issue, **kwargs):
        """
        Takes the external issue that has been linked via `get_issue`.

        Does anything needed after an issue has been linked, i.e. creating
        a comment for a linked issue.
        """

    def make_external_key(self, data):
        """
        Takes result of `get_issue` or `create_issue` and returns the formatted key
        """
        return data["key"]

    def get_issue_display_name(self, external_issue):
        """
        Returns the display name of the issue.

        This is not required but helpful for integrations whose external issue key
        does not match the desired display name.
        """
        return ""

    def get_repository_choices(self, group, **kwargs):
        """
        Returns the default repository and a set/subset of repositories of associated with the installation
        """
        try:
            repos = self.get_repositories()
        except ApiError:
            raise IntegrationError("Unable to retrieve repositories. Please try again later.")
        else:
            repo_choices = [(repo["identifier"], repo["name"]) for repo in repos]

        repo = kwargs.get("repo")
        if not repo:
            params = kwargs.get("params", {})
            defaults = self.get_project_defaults(group.project_id)
            repo = params.get("repo", defaults.get("repo"))

        try:
            default_repo = repo or repo_choices[0][0]
        except IndexError:
            return "", repo_choices

        # If a repo has been selected outside of the default list of
        # repos, stick it onto the front of the list so that it can be
        # selected.
        try:
            next(True for r in repo_choices if r[0] == default_repo)
        except StopIteration:
            repo_choices.insert(0, self.create_default_repo_choice(default_repo))

        return default_repo, repo_choices

    def create_default_repo_choice(self, default_repo):
        """
        Helper method for get_repository_choices
        Returns the choice for the default repo in a tuple to be added to the list of repository choices
        """
        return (default_repo, default_repo)

    def get_annotations_for_group_list(self, group_list):
        group_links = GroupLink.objects.filter(
            group_id__in=[group.id for group in group_list],
            project_id__in=list({group.project.id for group in group_list}),
            linked_type=GroupLink.LinkedType.issue,
            relationship=GroupLink.Relationship.references,
        )

        external_issues = ExternalIssue.objects.filter(
            id__in=[group_link.linked_id for group_link in group_links],
            integration_id=self.model.id,
        )

        # group annotations by group id
        annotations_by_group_id = defaultdict(list)
        for group_link in group_links:
            issues_for_group = filter(lambda x: x.id == group_link.linked_id, external_issues)
            annotations = self.map_external_issues_to_annotations(issues_for_group)
            annotations_by_group_id[group_link.group_id].extend(annotations)

        return annotations_by_group_id

    def map_external_issues_to_annotations(self, external_issues):
        annotations = []
        for ei in external_issues:
            link = self.get_issue_url(ei.key)
            label = self.get_issue_display_name(ei) or ei.key
            annotations.append(f'<a href="{link}">{label}</a>')

        return annotations

    def get_comment_id(self, comment):
        return comment["id"]

    def create_comment(self, issue_id, user_id, group_note):
        pass

    def update_comment(self, issue_id, user_id, group_note):
        pass


class IssueSyncMixin(IssueBasicMixin):
    comment_key = None
    outbound_status_key = None
    inbound_status_key = None
    outbound_assignee_key = None
    inbound_assignee_key = None

    def should_sync(self, attribute: str) -> bool:
        key = getattr(self, f"{attribute}_key", None)
        if key is None:
            return False
        value: bool = self.org_integration.config.get(key, False)
        return value

    def sync_assignee_outbound(
        self,
        external_issue: "ExternalIssue",
        user: Optional["User"],
        assign: bool = True,
        **kwargs: Any,
    ) -> None:
        """
        Propagate a sentry issue's assignee to a linked issue's assignee.
        If assign=True, we're assigning the issue. Otherwise, deassign.
        """
        raise NotImplementedError

    def sync_status_outbound(self, external_issue, is_resolved, project_id, **kwargs):
        """
        Propagate a sentry issue's status to a linked issue's status.
        """
        raise NotImplementedError

    def get_resolve_sync_action(self, data: Mapping[str, Any]) -> ResolveSyncAction:
        """
        Given webhook data, check whether the status category changed FROM
        "done" to something else, meaning the Sentry issue should be marked as
        unresolved or if the status category changed TO "done" from something
        else, meaning the sentry issue should be marked as resolved.

        Because checking the "done" states can rely on an API call, this function
        should calculate both "resolve" and "unresolve" to save a round trip.
        """
        raise NotImplementedError

    def sync_status_inbound(self, issue_key: str, data: Mapping[str, Any]) -> None:
        if not where_should_sync(self.model, "inbound_status", self.organization_id):
            return

        sync_status_inbound_task.apply_async(
            kwargs={
                "integration_id": self.model.id,
                "organization_id": self.organization_id,
                "issue_key": issue_key,
                "data": data,
            }
        )
