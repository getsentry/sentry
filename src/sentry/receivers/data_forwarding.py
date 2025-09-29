from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.models.project import Project
from sentry.signals import project_created


@project_created.connect(weak=False, dispatch_uid="enroll_project_in_data_forwarding")
def enroll_project_in_data_forwarding(project: Project, **kwargs):
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
