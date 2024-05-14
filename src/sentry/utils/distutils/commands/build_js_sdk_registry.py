import logging

from sentry.build._js_sdk_registry import _TARGET, _download

from .base import BaseBuildCommand

log = logging.getLogger(__name__)


class BuildJsSdkRegistryCommand(BaseBuildCommand):
    description = "build js sdk registry"

    def run(self):
        log.info("downloading js sdk information from the release registry")
        _download(_TARGET)
