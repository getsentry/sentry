from __future__ import absolute_import

import logging

from django.db import transaction
from uuid import uuid4

from sentry.api.bases.monitor import MonitorEndpoint
from sentry.api.serializers import serialize
from sentry.api.validators import MonitorValidator
from sentry.tasks.deletion import generic_delete
from sentry.models import AuditLogEntryEvent, Monitor, MonitorStatus

delete_logger = logging.getLogger("sentry.deletions.api")


class MonitorDetailsEndpoint(MonitorEndpoint):
    def get(self, request, project, monitor):
        """
        Retrieve a monitor
        ``````````````````

        :pparam string monitor_id: the id of the monitor.
        :auth: required
        """
        return self.respond(serialize(monitor, request.user))

    def put(self, request, project, monitor):
        """
        Update a monitor
        ````````````````

        :pparam string monitor_id: the id of the monitor.
        :auth: required
        """
        validator = MonitorValidator(
            data=request.data,
            partial=True,
            instance={
                "name": monitor.name,
                "status": monitor.status,
                "type": monitor.type,
                "config": monitor.config,
                "project": project,
            },
            context={"organization": project.organization, "access": request.access},
        )
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.save()

        params = {}
        if "name" in result:
            params["name"] = result["name"]
        if "status" in result:
            if result["status"] == MonitorStatus.ACTIVE:
                if monitor.status not in (MonitorStatus.OK, MonitorStatus.ERROR):
                    params["status"] = MonitorStatus.ACTIVE
            else:
                params["status"] = result["status"]
        if "config" in result:
            params["config"] = result["config"]
        if "project" in result and result["project"].id != monitor.project_id:
            params["project_id"] = result["project"].id

        if params:
            monitor.update(**params)
            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=monitor.id,
                event=AuditLogEntryEvent.MONITOR_EDIT,
                data=monitor.get_audit_log_data(),
            )

        return self.respond(serialize(monitor, request.user))

    def delete(self, request, project, monitor):
        """
        Delete a monitor
        ````````````````

        :pparam string monitor_id: the id of the monitor.
        :auth: required
        """
        # TODO(dcramer0:)
        with transaction.atomic():
            affected = (
                Monitor.objects.filter(id=monitor.id)
                .exclude(
                    status__in=[MonitorStatus.PENDING_DELETION, MonitorStatus.DELETION_IN_PROGRESS]
                )
                .update(status=MonitorStatus.PENDING_DELETION)
            )
            if not affected:
                return self.respond(status=404)

            transaction_id = uuid4().hex

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=monitor.id,
                event=AuditLogEntryEvent.MONITOR_REMOVE,
                data=monitor.get_audit_log_data(),
                transaction_id=transaction_id,
            )

        generic_delete.apply_async(
            kwargs={
                "app_label": Monitor._meta.app_label,
                "model_name": Monitor._meta.model_name,
                "object_id": monitor.id,
                "transaction_id": transaction_id,
                "actor_id": request.user.id,
            }
        )

        delete_logger.info(
            "object.delete.queued",
            extra={
                "object_id": monitor.id,
                "transaction_id": transaction_id,
                "model": Monitor.__name__,
            },
        )
        return self.respond(status=202)
