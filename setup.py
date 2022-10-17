#!/usr/bin/env python

import os
import sys

python_version = sys.version_info[:2]

if python_version < (3, 8):
    sys.exit(f"Error: Sentry requires at least Python 3.8 ({python_version})")
if python_version != (3, 8):
    import logging

    logger = logging.getLogger()
    logger.warning(f"A Python version different than 3.8 is being used ({python_version})")


from distutils.command.build import build as BuildCommand

from setuptools import setup
from setuptools.command.develop import develop as DevelopCommand
from setuptools.command.sdist import sdist as SDistCommand

ROOT = os.path.dirname(os.path.abspath(__file__))

# add sentry to path so we can import sentry.utils.distutils
sys.path.insert(0, os.path.join(ROOT, "src"))


from sentry.utils.distutils import (
    BuildAssetsCommand,
    BuildIntegrationDocsCommand,
    BuildJsSdkRegistryCommand,
)

IS_LIGHT_BUILD = os.environ.get("SENTRY_LIGHT_BUILD") == "1"


class SentrySDistCommand(SDistCommand):
    # If we are not a light build we want to also execute build_assets as
    # part of our source build pipeline.
    if not IS_LIGHT_BUILD:
        sub_commands = SDistCommand.sub_commands + [
            ("build_integration_docs", None),
            ("build_assets", None),
            ("build_js_sdk_registry", None),
        ]


class SentryBuildCommand(BuildCommand):
    def run(self):
        from distutils import log as distutils_log

        distutils_log.set_threshold(distutils_log.WARN)

        if not IS_LIGHT_BUILD:
            self.run_command("build_integration_docs")
            self.run_command("build_assets")
            self.run_command("build_js_sdk_registry")
        BuildCommand.run(self)


class SentryDevelopCommand(DevelopCommand):
    def run(self):
        DevelopCommand.run(self)
        if not IS_LIGHT_BUILD:
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


def get_requirements(env):
    with open(f"requirements-{env}.txt") as fp:
        return [x.strip() for x in fp.read().split("\n") if not x.startswith(("#", "--"))]


# Only include dev requirements in non-binary distributions as we don't want these
# to be listed in the wheels. Main reason for this is being able to use git/URL dependencies
# for development, which will be rejected by PyPI when trying to upload the wheel.
extras_require = {"rabbitmq": ["amqp==2.6.1"]}
if not sys.argv[1:][0].startswith("bdist"):
    extras_require["dev"] = get_requirements("dev-frozen")


setup(
    install_requires=get_requirements("frozen"),
    extras_require=extras_require,
    cmdclass=cmdclass,
)
