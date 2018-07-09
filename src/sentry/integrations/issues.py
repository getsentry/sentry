from __future__ import absolute_import

import logging
import six

from sentry.models import Activity, Event, Group, GroupStatus, ProjectIntegration
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


def sync_group_status_inbound(integration, status_value, external_issue_key):
    affected_groups = list(
        Group.objects.get_groups_by_external_issue(
            integration, external_issue_key,
        ).select_related('project'),
    )
    project_integration_configs = {
        pi.project_id: pi.config for pi in ProjectIntegration.objects.filter(
            project_id__in=[g.project_id for g in affected_groups]
        )
    }
    groups_to_resolve, groups_to_unresolve = determine_group_statuses(
        integration, affected_groups, project_integration_configs, status_value)
    change_group_statuses(groups_to_resolve, GroupStatus.RESOLVED)
    change_group_statuses(groups_to_unresolve, GroupStatus.UNRESOLVED)


def determine_group_statuses(integration, affected_groups,
                             project_integration_configs, status_value):
    groups_to_resolve = []
    groups_to_unresolve = []
    for group in affected_groups:
        project_config = project_integration_configs.get(group.project_id, {})
        resolve_when = project_config.get('resolve_when')
        unresolve_when = project_config.get('unresolve_when')

        # TODO(jess): make sure config validation doesn't
        # allow these to be the same
        if (unresolve_when and resolve_when) and (resolve_when == unresolve_when):
            logger.warning(
                'project-config-conflict', extra={
                    'project_id': group.project_id,
                    'integration_id': integration.id,
                }
            )
            continue
        # TODO(lb): Given David's Changes, unresolve_when and resolve_when
        # will be a list rather than a single value.
        if status_value == unresolve_when:
            groups_to_unresolve.append(group)
        elif status_value == resolve_when:
            groups_to_resolve.append(group)
    return groups_to_resolve, groups_to_unresolve


def change_group_statuses(groups, status):
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
