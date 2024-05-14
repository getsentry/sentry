import logging

from sentry.build._integration_docs import _TARGET, _sync_docs

from .base import BaseBuildCommand

log = logging.getLogger(__name__)


class BuildIntegrationDocsCommand(BaseBuildCommand):
    description = "build integration docs"

    def get_dist_paths(self):
        # Also see sentry.utils.integrationdocs.DOC_FOLDER
        return [_TARGET]

    def _build(self):
        log.info("downloading integration docs")
        _sync_docs(_TARGET)
