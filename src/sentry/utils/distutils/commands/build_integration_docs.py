import logging
import os.path

from .base import ROOT, BaseBuildCommand

log = logging.getLogger(__name__)


class BuildIntegrationDocsCommand(BaseBuildCommand):
    description = "build integration docs"

    def get_dist_paths(self):
        return [
            # Also see sentry.utils.integrationdocs.DOC_FOLDER
            os.path.join(ROOT, "src", "sentry", "integration-docs")
        ]

    def _build(self):
        from sentry.utils.integrationdocs import sync_docs

        log.info("downloading integration docs")
        sync_docs()
