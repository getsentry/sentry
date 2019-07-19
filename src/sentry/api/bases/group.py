from __future__ import absolute_import

import logging

from sentry.api.base import Endpoint
from sentry.api.bases.project import ProjectPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.utils.sdk import configure_scope
from sentry.models import Group, GroupLink, GroupStatus, get_group_with_redirect, Organization
from sentry.tasks.integrations import create_comment, update_comment

logger = logging.getLogger(__name__)

EXCLUDED_STATUSES = (
    GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS, GroupStatus.PENDING_MERGE
)


class GroupPermission(ProjectPermission):
    scope_map = {
        'GET': ['event:read', 'event:write', 'event:admin'],
        'POST': ['event:write', 'event:admin'],
        'PUT': ['event:write', 'event:admin'],
        'DELETE': ['event:admin'],
    }

    def has_object_permission(self, request, view, group):
        return super(GroupPermission, self).has_object_permission(request, view, group.project)


class GroupEndpoint(Endpoint):
    permission_classes = (GroupPermission, )

    def convert_args(self, request, issue_id, organization_slug=None, *args, **kwargs):
        # TODO(tkaemming): Ideally, this would return a 302 response, rather
        # than just returning the data that is bound to the new group. (It
        # technically shouldn't be a 301, since the response could change again
        # as the result of another merge operation that occurs later. This
        # wouldn't break anything though -- it will just be a "permanent"
        # redirect to *another* permanent redirect.) This would require
        # rebuilding the URL in one of two ways: either by hacking it in with
        # string replacement, or making the endpoint aware of the URL pattern
        # that caused it to be dispatched, and reversing it with the correct
        # `issue_id` keyword argument.
        if organization_slug:
            try:
                organization = Organization.objects.get_from_cache(
                    slug=organization_slug,
                )
            except Organization.DoesNotExist:
                raise ResourceDoesNotExist

            with configure_scope() as scope:
                scope.set_tag("organization", organization.id)

            request._request.organization = organization
        else:
            organization = None

        try:
            group, _ = get_group_with_redirect(
                issue_id,
                queryset=Group.objects.select_related('project', 'project__organization'),
                organization=organization,
            )
        except Group.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, group)

        with configure_scope() as scope:
            scope.set_tag("project", group.project_id)
            scope.set_tag("organization", group.project.organization_id)

        if group.status in EXCLUDED_STATUSES:
            raise ResourceDoesNotExist

        request._request.organization = group.project.organization

        kwargs['group'] = group

        return (args, kwargs)

    def get_external_issue_ids(self, group):
        return GroupLink.objects.filter(
            project_id=group.project_id,
            group_id=group.id,
            linked_type=GroupLink.LinkedType.issue,
        ).values_list('linked_id', flat=True)

    def create_external_comment(self, request, group, group_note):
        for external_issue_id in self.get_external_issue_ids(group):
            create_comment.apply_async(
                kwargs={
                    'external_issue_id': external_issue_id,
                    'group_note_id': group_note.id,
                    'user_id': request.user.id,
                }
            )

    def update_external_comment(self, request, group, group_note):
        for external_issue_id in self.get_external_issue_ids(group):
            update_comment.apply_async(
                kwargs={
                    'external_issue_id': external_issue_id,
                    'group_note_id': group_note.id,
                    'user_id': request.user.id,
                }
            )
