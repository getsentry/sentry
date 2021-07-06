"""Tasks for managing Debug Information Files from Apple App Store Connect.

Users can instruct Sentry to download dSYM from App Store Connect and put them into Sentry's
debug files.  These tasks enable this functionality.
"""

import logging
import pathlib
import tempfile

from sentry.lang.native import appconnect
from sentry.models import AppConnectBuild, Project, debugfile
from sentry.tasks.base import instrumented_task
from sentry.utils.sdk import configure_scope

logger = logging.getLogger(__name__)


# Sadly this decorator makes this entire function untyped for now as it does not itself have
# typing annotations.  So we do all the work outside of the decorated task function to work
# around this.
# Since all these args must be pickled we keep them to built-in types as well.
@instrumented_task(name="sentry.tasks.app_store_connect.dsym_download", queue="appstoreconnect")  # type: ignore
def dsym_download(project_id: int, config_id: str) -> None:
    inner_dsym_download(project_id=project_id, config_id=config_id)


def inner_dsym_download(
    project_id: int,
    config_id: str,
) -> None:
    """Downloads the dSYMs from App Store Connect and stores them in the Project's debug files."""
    # TODO(flub): we should only run one task ever for a project.  Is
    # sentry.cache.default_cache the right thing to put a "mutex" into?  See how
    # sentry.tasks.assemble uses this.
    with configure_scope() as scope:
        scope.set_tag("project", project_id)

    project = Project.objects.get(pk=project_id)
    config = appconnect.AppStoreConnectConfig.from_project_config(project, config_id)
    client = appconnect.AppConnectClient.from_config(config)
    itunes_client = client.itunes_client()

    builds = client.list_builds()
    for build in builds:
        try:
            build_state = AppConnectBuild.objects.get(
                project=project,
                app_id=build.app_id,
                platform=build.platform,
                bundle_short_version=build.version,
                bundle_version=build.build_number,
            )
        except AppConnectBuild.DoesNotExist:
            build_state = AppConnectBuild(
                project=project,
                app_id=build.app_id,
                bundle_id=config.bundleId,
                platform=build.platform,
                bundle_short_version=build.version,
                bundle_version=build.build_number,
                fetched=False,
            )

        if not build_state.fetched:
            with tempfile.NamedTemporaryFile() as dsyms_zip:
                try:
                    itunes_client.download_dsyms(build, pathlib.Path(dsyms_zip.name))
                except appconnect.NoDsymsError:
                    logger.debug("No dSYMs for build %s", build)
                    continue
                create_difs_from_dsyms_zip(dsyms_zip.name, project)
            build_state.fetched = True
            build_state.save()
            logger.debug("Uploaded dSYMs for build %s", build)


def create_difs_from_dsyms_zip(dsyms_zip: str, project: Project) -> None:
    with open(dsyms_zip, "rb") as fp:
        created = debugfile.create_files_from_dif_zip(fp, project, accept_unknown=True)
        for proj_debug_file in created:
            logger.debug("Created %r for project %s", proj_debug_file, project.id)
