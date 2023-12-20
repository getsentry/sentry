__all__ = ["ReleaseHook"]

from django.db import IntegrityError, router, transaction
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.exceptions import HookValidationError
from sentry.models.activity import Activity
from sentry.models.release import Release
from sentry.types.activity import ActivityType


class ReleaseHook:
    def __init__(self, project):
        self.project = project

    def start_release(self, version, **values):
        if not Release.is_valid_version(version):
            raise HookValidationError("Invalid release version: %s" % version)

        try:
            with transaction.atomic(router.db_for_write(Release)):
                release = Release.objects.create(
                    version=version, organization_id=self.project.organization_id, **values
                )
        except IntegrityError:
            release = Release.objects.get(
                version=version, organization_id=self.project.organization_id
            )
            release.update(**values)

        release.add_project(self.project)

    # TODO(dcramer): this is being used by the release details endpoint, but
    # it'd be ideal if most if not all of this logic lived there, and this
    # hook simply called out to the endpoint
    def set_commits(self, version, commit_list):
        """
        Commits should be ordered oldest to newest.

        Calling this method will remove all existing commit history.
        """
        if not Release.is_valid_version(version):
            raise HookValidationError("Invalid release version: %s" % version)

        project = self.project
        try:
            with transaction.atomic(router.db_for_write(Release)):
                release = Release.objects.create(
                    organization_id=project.organization_id, version=version
                )
        except IntegrityError:
            release = Release.objects.get(organization_id=project.organization_id, version=version)
        release.add_project(project)

        release.set_commits(commit_list)

    def set_refs(self, release, **values):
        pass

    def finish_release(self, version, **values):
        if not Release.is_valid_version(version):
            raise HookValidationError("Invalid release version: %s" % version)

        values.setdefault("date_released", timezone.now())
        try:
            with transaction.atomic(router.db_for_write(Release)):
                release = Release.objects.create(
                    version=version, organization_id=self.project.organization_id, **values
                )
        except IntegrityError:
            release = Release.objects.get(
                version=version, organization_id=self.project.organization_id
            )
            release.update(**values)

        release.add_project(self.project)

        Activity.objects.create(
            type=ActivityType.RELEASE.value,
            project=self.project,
            ident=Activity.get_version_ident(version),
            data={"version": version},
            datetime=values["date_released"],
        )
        self.set_refs(release=release, **values)

    def handle(self, request: Request) -> Response:
        raise NotImplementedError
