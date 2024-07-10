"""Tasks for managing Debug Information Files from Apple App Store Connect.

Users can instruct Sentry to download dSYM from App Store Connect and put them into Sentry's
debug files.  These tasks enable this functionality.
"""

from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.tasks.app_store_connect.dsym_download", queue="appstoreconnect", ignore_result=True
)
def dsym_download(project_id: int, config_id: str) -> None:
    # Noop
    # TODO(@anonrig): Remove when AppStore connect integration is sunset.
    return None
