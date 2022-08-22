import os.path
from distutils import log

from .base import BaseBuildCommand


class BuildIntegrationDocsCommand(BaseBuildCommand):
    description = "build integration docs"

    def get_dist_paths(self):
        return [
            # Also see sentry.utils.integrationdocs.DOC_FOLDER
            os.path.join(self.get_root_path(), "src", "sentry", "integration-docs")
        ]

    def _build(self):
        from sentry.utils.integrationdocs import sync_docs

        log.info("downloading integration docs")
        sync_docs()
