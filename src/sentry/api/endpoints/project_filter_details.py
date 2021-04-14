from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.ingest import inbound_filters
from sentry.models.auditlogentry import AuditLogEntryEvent


class ProjectFilterDetailsEndpoint(ProjectEndpoint):
    def put(self, request, project, filter_id):
        """
        Update a filter

        Update a project's filter.

            {method} {path}

        """
        current_filter = None
        for flt in inbound_filters.get_all_filter_specs():
            if flt.id == filter_id:
                current_filter = flt
                break
        else:
            raise ResourceDoesNotExist  # could not find filter with the requested id

        serializer = current_filter.serializer_cls(data=request.data, partial=True)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        current_state = inbound_filters.get_filter_state(filter_id, project)

        new_state = inbound_filters.set_filter_state(filter_id, project, serializer.validated_data)
        audit_log_state = AuditLogEntryEvent.PROJECT_ENABLE

        if filter_id == "legacy-browsers":
            if isinstance(current_state, bool) or isinstance(new_state, bool):
                returned_state = new_state
                if not new_state:
                    audit_log_state = AuditLogEntryEvent.PROJECT_DISABLE

            elif current_state - new_state:
                returned_state = current_state - new_state
                audit_log_state = AuditLogEntryEvent.PROJECT_DISABLE

            elif new_state - current_state:
                returned_state = new_state - current_state

            elif new_state == current_state:
                returned_state = new_state

        if filter_id in ("browser-extensions", "localhost", "web-crawlers"):
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
