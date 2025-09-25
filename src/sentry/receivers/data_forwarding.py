import logging

from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.models.project import Project
from sentry.signals import project_created

logger = logging.getLogger(__name__)


@project_created.connect(weak=False, dispatch_uid="enroll_project_in_data_forwarding")
def enroll_project_in_data_forwarding(project: Project):
    data_forwarders = DataForwarder.objects.filter(
        organization_id=project.organization_id, is_enabled=True, enroll_new_projects=True
    )

    enrolled_count = 0
    for data_forwarder in data_forwarders:
        if not DataForwarderProject.objects.filter(
            data_forwarder=data_forwarder, project=project
        ).exists():
            DataForwarderProject.objects.create(
                data_forwarder=data_forwarder,
                project=project,
                is_enabled=True,
                overrides={},
            )
            enrolled_count += 1

            logger.info(
                "Enrolled new project in data forwarder",
                extra={
                    "project_id": project.id,
                    "project_slug": project.slug,
                    "organization_id": project.organization_id,
                    "data_forwarder_id": data_forwarder.id,
                    "provider": data_forwarder.provider,
                },
            )

    if enrolled_count > 0:
        logger.info(
            "Auto-enrolled new project in data forwarders",
            extra={
                "project_id": project.id,
                "project_slug": project.slug,
                "organization_id": project.organization_id,
                "enrolled_count": enrolled_count,
            },
        )
