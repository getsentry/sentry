from typing import int
from django.db import router, transaction

from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.models.project import Project
from sentry.signals import project_created


@project_created.connect(weak=False, dispatch_uid="enroll_project_in_data_forwarding")
def enroll_project_in_data_forwarding(project: Project, **kwargs):
    data_forwarders = DataForwarder.objects.filter(
        organization_id=project.organization_id, is_enabled=True, enroll_new_projects=True
    )

    with transaction.atomic(router.db_for_write(DataForwarderProject)):
        for data_forwarder in data_forwarders:
            DataForwarderProject.objects.create(
                data_forwarder=data_forwarder,
                project=project,
                is_enabled=True,
                overrides={},
            )
