from __future__ import absolute_import

from rest_framework.response import Response

from sentry import filters
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import AuditLogEntryEvent


class ProjectFilterDetailsEndpoint(ProjectEndpoint):
    def put(self, request, project, filter_id):
        """
        Update a filter

        Update a project's filter.

            {method} {path}

        """
        try:
            filter = filters.get(filter_id)(project)
        except filters.FilterNotRegistered:
            raise ResourceDoesNotExist

        serializer = filter.serializer_cls(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        current_state = filter.is_enabled()
        new_state = filter.enable(serializer.object)
        audit_log_state = AuditLogEntryEvent.PROJECT_ENABLE

        if filter.id == 'legacy-browsers':
            added = new_state - current_state
            removed = current_state - new_state

            if removed:
                returned_state = removed
                audit_log_state = AuditLogEntryEvent.PROJECT_DISABLE
            elif added:
                returned_state = added

        if filter.id == 'browser-extensions' or filter.id == 'localhost' or filter.id == 'web-crawlers':
            returned_state = filter.id
            removed = current_state - new_state

            if removed == -1:
                audit_log_state = AuditLogEntryEvent.PROJECT_DISABLE

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=project.id,
            event=audit_log_state,
            data={"state": returned_state},
        )

        return Response(status=201)
