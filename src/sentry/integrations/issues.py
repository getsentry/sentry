from __future__ import absolute_import

import logging
import six

from sentry.models import (
    Activity, Event, Group, GroupStatus, IntegrationExternalProject,
    OrganizationIntegration
)
from sentry.utils.http import absolute_uri
from sentry.utils.safe import safe_execute

logger = logging.getLogger('sentry.integrations.issues')


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

    def get_external_project_id(self, data):
        """
        Given webhook data, pull out external project id
        """
        raise NotImplementedError

    def get_external_issue_status(self, data):
        """
        Given webhook data, pull out external issue status
        """
        raise NotImplementedError

    def update_group_status(self, groups, status, activity_type):
        updated = Group.objects.filter(
            id__in=[g.id for g in groups],
        ).exclude(
            status=status,
        ).update(
            status=status,
        )
        if updated:
            for group in groups:
                Activity.objects.create(
                    project=group.project,
                    group=group,
                    type=activity_type,
                )

    def sync_status_inbound(self, issue_key, data):
        affected_groups = list(
            Group.objects.get_groups_by_external_issue(
                self.model, issue_key,
            ).select_related('project'),
        )

        org_integration_to_org_map = dict(
            OrganizationIntegration.objects.filter(
                integration=self.model,
            ).values_list('id', 'organization_id'),
        )

        external_projects = list(
            IntegrationExternalProject.objects.filter(
                organization_integration_id__in=org_integration_to_org_map.keys(),
                external_id=self.get_external_project_id(data),
            ),
        )

        external_projects_by_org = {
            org_integration_to_org_map[int_external_p.organization_integration_id]: int_external_p
            for int_external_p in external_projects
        }

        groups_to_resolve = []
        groups_to_unresolve = []

        for group in affected_groups:
            external_project = external_projects_by_org.get(group.project.organization_id)
            if external_project is None:
                continue
            issue_status = self.get_external_issue_status(data)

            # TODO(jess): make sure config validation doesn't
            # allow these to be the same
            if external_project.resolved_status == external_project.unresolved_status:
                logger.warning(
                    'sync-config-conflict', extra={
                        'organization_id': group.project.organization_id,
                        'integration_id': self.model.id,
                        'provider': self.model.get_provider(),
                    }
                )
                continue

            if issue_status == external_project.unresolved_status:
                groups_to_unresolve.append(group)
            elif issue_status == external_project.resolved_status:
                groups_to_resolve.append(group)

        if groups_to_resolve:
            self.update_group_status(
                groups_to_resolve,
                GroupStatus.RESOLVED,
                Activity.SET_RESOLVED,
            )

        if groups_to_unresolve:
            self.update_group_status(
                groups_to_unresolve,
                GroupStatus.UNRESOLVED,
                Activity.SET_UNRESOLVED
            )
