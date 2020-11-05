from __future__ import absolute_import

import logging
import six
from collections import defaultdict

from sentry import features
from sentry.models.useroption import UserOption
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.models import Activity, ExternalIssue, Group, GroupLink, GroupStatus, Organization
from sentry.utils.http import absolute_uri
from sentry.utils.safe import safe_execute
from sentry.utils.compat import filter

logger = logging.getLogger("sentry.integrations.issues")


class IssueBasicMixin(object):
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
        for interface in six.itervalues(event.interfaces):
            output = safe_execute(interface.to_string, event, _with_transaction=False)
            if output:
                result.append(output)
        return "\n\n".join(result)

    def get_group_description(self, group, event, **kwargs):
        params = {}
        if kwargs.get("link_referrer"):
            params["referrer"] = kwargs.get("link_referrer")
        output = [
            u"Sentry Issue: [{}]({})".format(
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

        >>>{'title': 'TypeError: Object [object Object] has no method "updateFrom"''}

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

    def _get_defaults_user_option_key(self):
        provider = self.org_integration.integration.provider
        return "issues:defaults:{}".format(provider)

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
            project_defaults = {k: v for k, v in six.iteritems(data) if k in persisted_fields}
            self.org_integration.config.setdefault("project_issue_defaults", {}).setdefault(
                six.text_type(project.id), {}
            ).update(project_defaults)
            self.org_integration.save()

        user_persisted_fields = self.get_persisted_user_default_config_fields()
        if user_persisted_fields:
            user_defaults = {}
            defaults_user_option_key = self._get_defaults_user_option_key()
            user_defaults.update(
                UserOption.objects.get_value(
                    user=user, key=defaults_user_option_key, default={}, project=project
                )
            )
            user_defaults.update(
                {k: v for k, v in six.iteritems(data) if k in user_persisted_fields}
            )
            UserOption.objects.set_value(
                user=user, key=defaults_user_option_key, value=user_defaults, project=project
            )

    def get_defaults(self, project, user):
        project_defaults = self.get_project_defaults(project.id)

        defaults_user_option_key = self._get_defaults_user_option_key()
        user_defaults = UserOption.objects.get_value(
            user=user, key=defaults_user_option_key, default={}, project=project
        )

        defaults = {}
        defaults.update(project_defaults)
        defaults.update(user_defaults)

        return defaults

    # TODO(saif): Make private and move all usages over to `get_defaults`
    def get_project_defaults(self, project_id):
        return self.org_integration.config.get("project_issue_defaults", {}).get(
            six.text_type(project_id), {}
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
        pass

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
            raise IntegrationError("Unable to retrive repositories. Please try again later.")
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
            project_id__in=list(set(group.project.id for group in group_list)),
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
            annotations.append('<a href="%s">%s</a>' % (link, label))

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

    def should_sync(self, attribute):
        try:
            key = getattr(self, "%s_key" % attribute)
        except AttributeError:
            return False

        if key is None:
            return False

        config = self.org_integration.config

        return config.get(key, False)

    def sync_assignee_outbound(self, external_issue, user, assign=True, **kwargs):
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

    def should_unresolve(self, data):
        """
        Given webhook data, check whether the status
        category changed FROM "done" to something else,
        meaning the sentry issue should be marked as
        unresolved

        >>> def should_unresolve(self, data):
        >>>     client = self.get_client()
        >>>     statuses = client.get_statuses()
        >>>     done_statuses = [s['id'] for s in statuses if s['category'] == 'done']
        >>>     return data['from_status'] in done_statuses \
        >>>         and data['to_status'] not in done_statuses

        """
        raise NotImplementedError

    def should_resolve(self, data):
        """
        Given webhook data, check whether the status
        category changed TO "done" from something else,
        meaning the sentry issue should be marked as
        resolved

        see example above
        """
        raise NotImplementedError

    def update_group_status(self, groups, status, activity_type):
        updated = (
            Group.objects.filter(id__in=[g.id for g in groups])
            .exclude(status=status)
            .update(status=status)
        )
        if updated:
            for group in groups:
                activity = Activity.objects.create(
                    project=group.project, group=group, type=activity_type
                )
                activity.send_notification()

    def sync_status_inbound(self, issue_key, data):
        if not self.should_sync("inbound_status"):
            return

        organization = Organization.objects.get(id=self.organization_id)
        has_issue_sync = features.has("organizations:integrations-issue-sync", organization)

        if not has_issue_sync:
            return

        affected_groups = list(
            Group.objects.get_groups_by_external_issue(self.model, issue_key)
            .filter(project__organization_id=self.organization_id)
            .select_related("project")
        )

        groups_to_resolve = []
        groups_to_unresolve = []

        should_resolve = self.should_resolve(data)
        should_unresolve = self.should_unresolve(data)

        for group in affected_groups:

            # this probably shouldn't be possible unless there
            # is a bug in one of those methods
            if should_resolve is True and should_unresolve is True:
                logger.warning(
                    "sync-config-conflict",
                    extra={
                        "organization_id": group.project.organization_id,
                        "integration_id": self.model.id,
                        "provider": self.model.get_provider(),
                    },
                )
                continue

            if should_unresolve:
                groups_to_unresolve.append(group)
            elif should_resolve:
                groups_to_resolve.append(group)

        if groups_to_resolve:
            self.update_group_status(groups_to_resolve, GroupStatus.RESOLVED, Activity.SET_RESOLVED)

        if groups_to_unresolve:
            self.update_group_status(
                groups_to_unresolve, GroupStatus.UNRESOLVED, Activity.SET_UNRESOLVED
            )
