from __future__ import absolute_import

from rest_framework.response import Response

from sentry import message_filters
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.auditlogentry import AuditLogEntryEvent
import six


class ProjectFilterDetailsEndpoint(ProjectEndpoint):
    def put(self, request, project, filter_id):
        """
        Update a filter

        Update a project's filter.

            {method} {path}

        """
        current_filter = None
        for flt in message_filters.get_all_filters():
            if flt.spec.id == filter_id:
                current_filter = flt
                break
        else:
            raise ResourceDoesNotExist  # could not find filter with the requested id

        serializer = current_filter.spec.serializer_cls(data=request.DATA, partial=True)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        current_state = message_filters.get_filter_state(filter_id, project)

        new_state = message_filters.set_filter_state(filter_id, project, serializer.object)
        audit_log_state = AuditLogEntryEvent.PROJECT_ENABLE

        if filter_id == 'legacy-browsers':
            if isinstance(current_state, bool) or new_state == 0 or isinstance(
                    new_state, six.binary_type):
                returned_state = new_state

                if isinstance(new_state, six.binary_type):
                    audit_log_state = AuditLogEntryEvent.PROJECT_DISABLE
                    returned_state = current_state

            elif current_state - new_state:
                returned_state = current_state - new_state
                audit_log_state = AuditLogEntryEvent.PROJECT_DISABLE

            elif new_state - current_state:
                returned_state = new_state - current_state

            elif new_state == current_state:
                returned_state = new_state

        if filter_id in ('browser-extensions', 'localhost', 'web-crawlers'):
            returned_state = filter_id
            removed = current_state - new_state

            if removed == 1:
                audit_log_state = AuditLogEntryEvent.PROJECT_DISABLE

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=project.id,
            event=audit_log_state,
            data={"state": returned_state},
        )

        return Response(status=201)
