from __future__ import absolute_import

import logging
import six

from sentry.models import Activity, ExternalIssue, Event, Group, GroupStatus
from sentry.utils.http import absolute_uri
from sentry.utils.safe import safe_execute

logger = logging.getLogger(__name__)


class IssueBasicMixin(object):

    def get_group_title(self, group, event, **kwargs):
        return event.error()

    def get_group_body(self, group, event, **kwargs):
        result = []
        for interface in six.itervalues(event.interfaces):
            output = safe_execute(interface.to_string, event, _with_transaction=False)
            if output:
                result.append(output)
        return '\n\n'.join(result)

    def get_group_description(self, group, event, **kwargs):
        output = [
            absolute_uri(group.get_absolute_url()),
        ]
        body = self.get_group_body(group, event)
        if body:
            output.extend([
                '',
                '```',
                body,
                '```',
            ])
        return '\n'.join(output)

    def get_create_issue_config(self, group, **kwargs):
        """
        These fields are used to render a form for the user,
        and are then passed in the format of:

        >>>{'title': 'TypeError: Object [object Object] has no method "updateFrom"''}

        to `create_issue`, which handles creation of the issue
        in Jira, VSTS, GitHub, etc
        """
        event = group.get_latest_event()
        if event is not None:
            Event.objects.bind_nodes([event], 'data')

        return [
            {
                'name': 'title',
                'label': 'Title',
                'default': self.get_group_title(group, event, **kwargs),
                'type': 'string',
            }, {
                'name': 'description',
                'label': 'Description',
                'default': self.get_group_description(group, event, **kwargs),
                'type': 'textarea',
            }
        ]

    def get_link_issue_config(self, group, **kwargs):
        """
        Used by the `GroupIntegrationDetailsEndpoint` to
        create an `ExternalIssue` using title/description
        obtained from calling `get_issue` described below.
        """
        return [
            {
                'name': 'externalIssue',
                'label': 'Issue',
                'default': '',
                'type': 'string',
            }
        ]

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
        return data['key']


class IssueSyncMixin(IssueBasicMixin):
    DONE_CATEGORIES = []

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

    def sync_group_status_inbound(self, integration, status_value, external_issue_key):
        affected_groups = list(
            Group.objects.get_groups_by_external_issue(
                integration, external_issue_key,
            )
        )
        # assuming changed external_issues table
        # get external_project_id
        external_project_id = ExternalIssue.objects.filter(
            integration_id=integration.id,
            key=external_issue_key,
        )[0].external_project_id

        # GET Statuses and find category of status_value with external_project_id
        category = self.determine_status_category(integration, status_value, external_project_id)
        if category in self.DONE_CATEGORIES:
            self.change_group_statuses(affected_groups, GroupStatus.RESOLVED)
        else:
            self.change_group_statuses(affected_groups, GroupStatus.UNRESOLVED)

    def determine_status_category(self, integration, status_value, external_project_id):
        # Can be overwritten by the inheriting class
        raise NotImplementedError

    def change_group_statuses(self, groups, status):
        if not groups:
            return
        updated_groups = Group.objects.filter(
            id__in=[g.id for g in groups],
        ).exclude(
            status=status,
        ).update(
            status=status,
        )
        if not updated_groups:
            return
        for group in groups:
            Activity.objects.create(
                project=group.project,
                group=group,
                type=status,
            )
