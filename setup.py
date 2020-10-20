#!/usr/bin/env python
from __future__ import absolute_import

import os
import sys

if os.environ.get("SENTRY_PYTHON3") == "1" and sys.version_info[:2] != (3, 6):
    sys.exit("Error: Sentry [In EXPERIMENTAL python 3 mode] requires Python 3.6.")

if os.environ.get("SENTRY_PYTHON3") != "1" and sys.version_info[:2] != (2, 7):
    sys.exit("Error: Sentry requires Python 2.7.")

from distutils.command.build import build as BuildCommand
from setuptools import setup, find_packages
from setuptools.command.sdist import sdist as SDistCommand
from setuptools.command.develop import develop as DevelopCommand

ROOT = os.path.dirname(os.path.abspath(__file__))

# add sentry to path so we can import sentry.utils.distutils
sys.path.insert(0, os.path.join(ROOT, "src"))


from sentry.utils.distutils import (
    BuildAssetsCommand,
    BuildIntegrationDocsCommand,
    BuildJsSdkRegistryCommand,
)


VERSION = "20.10.1"
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
    with open(u"requirements-{}.txt".format(env)) as fp:
        return [x.strip() for x in fp.read().split("\n") if not x.startswith("#")]


# Only include dev requirements in non-binary distributions as we don't want these
# to be listed in the wheels. Main reason for this is being able to use git/URL dependencies
# for development, which will be rejected by PyPI when trying to upload the wheel.
extras_require = {"rabbitmq": ["amqp==2.6.1"]}
if not sys.argv[1:][0].startswith("bdist"):
    extras_require["dev"] = get_requirements("dev")


setup(
    name="sentry",
    version=VERSION,
    author="Sentry",
    author_email="oss@sentry.io",
    url="https://sentry.io",
    description="A realtime logging and aggregation server.",
    long_description=open(os.path.join(ROOT, "README.md")).read(),
    long_description_content_type="text/markdown",
    package_dir={"": "src"},
    packages=find_packages("src"),
    zip_safe=False,
    install_requires=get_requirements("base"),
    extras_require=extras_require,
    cmdclass=cmdclass,
    license="BSL-1.1",
    include_package_data=True,
    package_data={"sentry": ["static/sentry/dist/**", "static/sentry/js/**"]},
    exclude_package_data={"sentry": ["static/sentry/**"]},
    entry_points={
        "console_scripts": ["sentry = sentry.runner:main"],
        "sentry.apps": [
            # TODO: This can be removed once the getsentry tests no longer check for this app
            "auth_activedirectory = sentry.auth.providers.saml2.activedirectory",
            "auth_auth0 = sentry.auth.providers.saml2.auth0",
            "auth_github = sentry.auth.providers.github",
            "auth_okta = sentry.auth.providers.saml2.okta",
            "auth_onelogin = sentry.auth.providers.saml2.onelogin",
            "auth_rippling = sentry.auth.providers.saml2.rippling",
            "auth_saml2 = sentry.auth.providers.saml2.generic",
            "jira_ac = sentry_plugins.jira_ac",
            "jira = sentry_plugins.jira",
            "freight = sentry_plugins.freight",
            "opsgenie = sentry_plugins.opsgenie",
            "redmine = sentry_plugins.redmine",
            "sessionstack = sentry_plugins.sessionstack",
            "teamwork = sentry_plugins.teamwork",
            "trello = sentry_plugins.trello",
            "twilio = sentry_plugins.twilio",
        ],
        "sentry.plugins": [
            "amazon_sqs = sentry_plugins.amazon_sqs.plugin:AmazonSQSPlugin",
            "asana = sentry_plugins.asana.plugin:AsanaPlugin",
            "bitbucket = sentry_plugins.bitbucket.plugin:BitbucketPlugin",
            "clubhouse = sentry_plugins.clubhouse.plugin:ClubhousePlugin",
            "freight = sentry_plugins.freight.plugin:FreightPlugin",
            "github = sentry_plugins.github.plugin:GitHubPlugin",
            "gitlab = sentry_plugins.gitlab.plugin:GitLabPlugin",
            "heroku = sentry_plugins.heroku.plugin:HerokuPlugin",
            "jira = sentry_plugins.jira.plugin:JiraPlugin",
            "jira_ac = sentry_plugins.jira_ac.plugin:JiraACPlugin",
            "opsgenie = sentry_plugins.opsgenie.plugin:OpsGeniePlugin",
            "pagerduty = sentry_plugins.pagerduty.plugin:PagerDutyPlugin",
            "phabricator = sentry_plugins.phabricator.plugin:PhabricatorPlugin",
            "pivotal = sentry_plugins.pivotal.plugin:PivotalPlugin",
            "pushover = sentry_plugins.pushover.plugin:PushoverPlugin",
            "redmine = sentry_plugins.redmine.plugin:RedminePlugin",
            "segment = sentry_plugins.segment.plugin:SegmentPlugin",
            "sessionstack = sentry_plugins.sessionstack.plugin:SessionStackPlugin",
            "slack = sentry_plugins.slack.plugin:SlackPlugin",
            "splunk = sentry_plugins.splunk.plugin:SplunkPlugin",
            "teamwork = sentry_plugins.teamwork.plugin:TeamworkPlugin",
            "trello = sentry_plugins.trello.plugin:TrelloPlugin",
            "twilio = sentry_plugins.twilio.plugin:TwilioPlugin",
            "victorops = sentry_plugins.victorops.plugin:VictorOpsPlugin",
            "vsts = sentry_plugins.vsts.plugin:VstsPlugin",
        ],
    },
    classifiers=[
        "Framework :: Django",
        "Intended Audience :: Developers",
        "Intended Audience :: System Administrators",
        "Operating System :: POSIX :: Linux",
        "Programming Language :: Python :: 2",
        "Programming Language :: Python :: 2.7",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Topic :: Software Development",
        "License :: Other/Proprietary License",
    ],
)
