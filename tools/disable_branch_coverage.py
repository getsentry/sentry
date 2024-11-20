from coverage import CoveragePlugin
from coverage.config import CoverageConfig
from coverage.plugin_support import Plugins


class DisableBranchCoverage(CoveragePlugin):
    def configure(self, config: CoverageConfig) -> None:
        config.set_option("run:branch", False)


def coverage_init(reg: Plugins, options: dict[str, str]) -> None:
    reg.add_configurer(DisableBranchCoverage())
