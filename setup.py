#!/usr/bin/env python

import os
import sys

from setuptools import setup
from setuptools.command.build import build as BuildCommand
from setuptools.command.develop import develop as DevelopCommand
from setuptools.command.sdist import sdist as SDistCommand

ROOT = os.path.dirname(os.path.abspath(__file__))

# add sentry to path so we can import sentry.utils.distutils
sys.path.insert(0, os.path.join(ROOT, "src"))


from sentry.utils.distutils.commands.build_assets import BuildAssetsCommand
from sentry.utils.distutils.commands.build_integration_docs import BuildIntegrationDocsCommand
from sentry.utils.distutils.commands.build_js_sdk_registry import BuildJsSdkRegistryCommand


class SentrySDistCommand(SDistCommand):
    sub_commands = [
        *SDistCommand.sub_commands,
        ("build_integration_docs", None),
        ("build_assets", None),
        ("build_js_sdk_registry", None),
    ]


class SentryBuildCommand(BuildCommand):
    def run(self):
        import logging

        logging.getLogger("sentry").setLevel(logging.WARNING)

        self.run_command("build_integration_docs")
        self.run_command("build_assets")
        self.run_command("build_js_sdk_registry")
        super().run()


class SentryDevelopCommand(DevelopCommand):
    def run(self):
        super().run()
        self.run_command("build_integration_docs")
        self.run_command("build_assets")
        self.run_command("build_js_sdk_registry")


cmdclass = {
    "sdist": SentrySDistCommand,
    "develop": SentryDevelopCommand,
    "build": SentryBuildCommand,
    "build_assets": BuildAssetsCommand,
    "build_integration_docs": BuildIntegrationDocsCommand,
    "build_js_sdk_registry": BuildJsSdkRegistryCommand,
}

setup(cmdclass=cmdclass)
