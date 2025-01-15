from __future__ import annotations

import contextlib
import copy
import io
import os
import random
import zipfile
from base64 import b64encode
from binascii import hexlify
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from enum import Enum
from hashlib import sha1
from importlib import import_module
from typing import Any
from unittest import mock
from uuid import uuid4

import orjson
import petname
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.files.base import ContentFile
from django.db import router, transaction
from django.test.utils import override_settings
from django.utils import timezone
from django.utils.text import slugify

from sentry.auth.access import RpcBackedAccess
from sentry.auth.services.auth.model import RpcAuthState, RpcMemberSsoState
from sentry.constants import SentryAppInstallationStatus, SentryAppStatus
from sentry.event_manager import EventManager
from sentry.eventstore.models import GroupEvent
from sentry.hybridcloud.models.outbox import RegionOutbox, outbox_context
from sentry.hybridcloud.models.webhookpayload import WebhookPayload
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.incidents.logic import (
    create_alert_rule,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    query_datasets_to_type,
)
from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import (
    Incident,
    IncidentActivity,
    IncidentProject,
    IncidentTrigger,
    IncidentType,
    TriggerStatus,
)
from sentry.integrations.models.doc_integration import DocIntegration
from sentry.integrations.models.doc_integration_avatar import DocIntegrationAvatar
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.integration_external_project import IntegrationExternalProject
from sentry.integrations.models.integration_feature import (
    Feature,
    IntegrationFeature,
    IntegrationTypes,
)
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.types import ExternalProviders
from sentry.issues.grouptype import get_group_type_by_type_id
from sentry.models.activity import Activity
from sentry.models.apikey import ApiKey
from sentry.models.apitoken import ApiToken
from sentry.models.artifactbundle import ArtifactBundle
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
)
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.environment import Environment
from sentry.models.eventattachment import EventAttachment
from sentry.models.files.control_file import ControlFile
from sentry.models.files.file import File
from sentry.models.group import Group
from sentry.models.grouphistory import GroupHistory
from sentry.models.grouplink import GroupLink
from sentry.models.grouprelease import GroupRelease
from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.organizationslugreservation import OrganizationSlugReservation
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.project import Project
from sentry.models.projectbookmark import ProjectBookmark
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.models.projecttemplate import ProjectTemplate
from sentry.models.release import Release, ReleaseStatus
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releasefile import ReleaseFile, update_artifact_index
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.repository import Repository
from sentry.models.rule import Rule
from sentry.models.rulesnooze import RuleSnooze
from sentry.models.savedsearch import SavedSearch
from sentry.models.team import Team
from sentry.models.userreport import UserReport
from sentry.notifications.models.notificationaction import (
    ActionService,
    ActionTarget,
    ActionTrigger,
    NotificationAction,
)
from sentry.notifications.models.notificationsettingprovider import NotificationSettingProvider
from sentry.organizations.services.organization import RpcOrganization, RpcUserOrganizationContext
from sentry.sentry_apps.installations import (
    SentryAppInstallationCreator,
    SentryAppInstallationTokenCreator,
)
from sentry.sentry_apps.logic import SentryAppCreator
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_avatar import SentryAppAvatar
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.models.sentry_app_installation_for_provider import (
    SentryAppInstallationForProvider,
)
from sentry.sentry_apps.models.servicehook import ServiceHook
from sentry.sentry_apps.services.app.serial import serialize_sentry_app_installation
from sentry.sentry_apps.services.hook import hook_service
from sentry.sentry_apps.token_exchange.grant_exchanger import GrantExchanger
from sentry.signals import project_created
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscriptionDataSourceHandler
from sentry.tempest.models import MessageType as TempestMessageType
from sentry.tempest.models import TempestCredentials
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.activity import ActivityType
from sentry.types.actor import Actor
from sentry.types.region import Region, get_local_region, get_region_by_name
from sentry.types.token import AuthTokenType
from sentry.uptime.models import (
    IntervalSecondsLiteral,
    ProjectUptimeSubscription,
    ProjectUptimeSubscriptionMode,
    UptimeStatus,
    UptimeSubscription,
    UptimeSubscriptionRegion,
)
from sentry.users.models.identity import Identity, IdentityProvider, IdentityStatus
from sentry.users.models.user import User
from sentry.users.models.user_avatar import UserAvatar
from sentry.users.models.user_option import UserOption
from sentry.users.models.useremail import UserEmail
from sentry.users.models.userpermission import UserPermission
from sentry.users.models.userrole import UserRole
from sentry.users.services.user import RpcUser
from sentry.utils import loremipsum
from sentry.utils.performance_issues.performance_problem import PerformanceProblem
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    DataSource,
    DataSourceDetector,
    Detector,
    DetectorState,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.registry import data_source_type_registry
from social_auth.models import UserSocialAuth


class EventType(Enum):
    ERROR = "error"
    DEFAULT = "default"


def get_fixture_path(*parts: str) -> str:
    path = os.path.realpath(__file__)
    for _ in range(4):  # src/sentry/testutils/{__file__}
        path = os.path.dirname(path)
    return os.path.join(path, "fixtures", *parts)


def make_sentence(words=None):
    if words is None:
        words = int(random.weibullvariate(8, 3))
    return " ".join(random.choice(loremipsum.words) for _ in range(words))


def make_word(words=None):
    if words is None:
        words = int(random.weibullvariate(8, 3))
    return random.choice(loremipsum.words)


DEFAULT_EVENT_DATA = {
    "extra": {
        "loadavg": [0.97607421875, 0.88330078125, 0.833984375],
        "sys.argv": [
            "/Users/dcramer/.virtualenvs/sentry/bin/raven",
            "test",
            "https://ebc35f33e151401f9deac549978bda11:f3403f81e12e4c24942d505f086b2cad@sentry.io/1",
        ],
        "user": "dcramer",
    },
    "modules": {"raven": "3.1.13"},
    "request": {
        "cookies": {},
        "data": {},
        "env": {},
        "headers": {},
        "method": "GET",
        "query_string": "",
        "url": "http://example.com",
    },
    "stacktrace": {
        "frames": [
            {
                "abs_path": "www/src/sentry/models/foo.py",
                "context_line": "                        string_max_length=self.string_max_length)",
                "filename": "sentry/models/foo.py",
                "function": "build_msg",
                "in_app": True,
                "lineno": 29,
                "module": "raven.base",
                "post_context": [
                    "                },",
                    "            })",
                    "",
                    "        if 'stacktrace' in data:",
                    "            if self.include_paths:",
                ],
                "pre_context": [
                    "",
                    "            data.update({",
                    "                'stacktrace': {",
                    "                    'frames': get_stack_info(frames,",
                    "                        list_max_length=self.list_max_length,",
                ],
                "vars": {
                    "culprit": "raven.scripts.runner",
                    "date": "datetime.datetime(2013, 2, 14, 20, 6, 33, 479471)",
                    "event_id": "598fb19363e745ec8be665e6ba88b1b2",
                    "event_type": "raven.events.Message",
                    "frames": "<generator object iter_stack_frames at 0x103fef050>",
                    "handler": "<raven.events.Message object at 0x103feb710>",
                    "k": "logentry",
                    "public_key": None,
                    "result": {
                        "logentry": "{'message': 'This is a test message generated using ``raven test``', 'params': []}"
                    },
                    "self": "<raven.base.Client object at 0x104397f10>",
                    "stack": True,
                    "tags": None,
                    "time_spent": None,
                },
            },
            {
                "abs_path": "/Users/dcramer/.virtualenvs/sentry/lib/python2.7/site-packages/raven/base.py",
                "context_line": "                        string_max_length=self.string_max_length)",
                "filename": "raven/base.py",
                "function": "build_msg",
                "in_app": False,
                "lineno": 290,
                "module": "raven.base",
                "post_context": [
                    "                },",
                    "            })",
                    "",
                    "        if 'stacktrace' in data:",
                    "            if self.include_paths:",
                ],
                "pre_context": [
                    "",
                    "            data.update({",
                    "                'stacktrace': {",
                    "                    'frames': get_stack_info(frames,",
                    "                        list_max_length=self.list_max_length,",
                ],
                "vars": {
                    "culprit": "raven.scripts.runner",
                    "date": "datetime.datetime(2013, 2, 14, 20, 6, 33, 479471)",
                    "event_id": "598fb19363e745ec8be665e6ba88b1b2",
                    "event_type": "raven.events.Message",
                    "frames": "<generator object iter_stack_frames at 0x103fef050>",
                    "handler": "<raven.events.Message object at 0x103feb710>",
                    "k": "logentry",
                    "public_key": None,
                    "result": {
                        "logentry": "{'message': 'This is a test message generated using ``raven test``', 'params': []}"
                    },
                    "self": "<raven.base.Client object at 0x104397f10>",
                    "stack": True,
                    "tags": None,
                    "time_spent": None,
                },
            },
        ]
    },
    "tags": [],
    "platform": "python",
}


def _patch_artifact_manifest(path, org=None, release=None, project=None, extra_files=None):
    with open(path, "rb") as fp:
        manifest = orjson.loads(fp.read())
    if org:
        manifest["org"] = org
    if release:
        manifest["release"] = release
    if project:
        manifest["project"] = project
    for path in extra_files or {}:
        manifest["files"][path] = {"url": path}
    return orjson.dumps(manifest).decode()


# TODO(dcramer): consider moving to something more scalable like factoryboy
class Factories:
    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_organization(name=None, owner=None, region: Region | str | None = None, **kwargs):
        if not name:
            name = petname.generate(2, " ", letters=10).title()

        with contextlib.ExitStack() as ctx:
            if region is None or SiloMode.get_current_mode() == SiloMode.MONOLITH:
                region_name = get_local_region().name
            else:
                if isinstance(region, Region):
                    region_name = region.name
                else:
                    region_obj = get_region_by_name(region)  # Verify it exists
                    region_name = region_obj.name

                ctx.enter_context(
                    override_settings(SILO_MODE=SiloMode.REGION, SENTRY_REGION=region_name)
                )

            with outbox_context(flush=False):
                org = Organization.objects.create(name=name, **kwargs)

            with assume_test_silo_mode(SiloMode.CONTROL):
                # Organization mapping creation relies on having a matching org slug reservation
                OrganizationSlugReservation(
                    organization_id=org.id,
                    region_name=region_name,
                    user_id=owner.id if owner else -1,
                    slug=org.slug,
                ).save(unsafe_write=True)

            # Manually replicate org data after adding an org slug reservation
            org.handle_async_replication(org.id)

            # Flush remaining organization update outboxes accumulated by org create
            RegionOutbox(
                shard_identifier=org.id,
                shard_scope=OutboxScope.ORGANIZATION_SCOPE,
                category=OutboxCategory.ORGANIZATION_UPDATE,
            ).drain_shard()

        if owner:
            Factories.create_member(organization=org, user_id=owner.id, role="owner")
        return org

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_org_mapping(org=None, **kwds):
        if org:
            kwds.setdefault("organization_id", org.id)
            kwds.setdefault("slug", org.slug)
            kwds.setdefault("name", org.name)
            kwds.setdefault("idempotency_key", uuid4().hex)
            kwds.setdefault("region_name", "na")
        return OrganizationMapping.objects.create(**kwds)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_member(teams=None, team_roles=None, **kwargs):
        kwargs.setdefault("role", "member")
        teamRole = kwargs.pop("teamRole", None)

        # user_id will have precedence over user
        user = kwargs.pop("user", None)
        user_id = kwargs.pop("user_id", None)
        if not user_id and user:
            user_id = user.id
        kwargs["user_id"] = user_id

        # inviter_id will have precedence over inviter
        inviter = kwargs.pop("inviter", None)
        inviter_id = kwargs.pop("inviter_id", None)
        if not inviter_id and inviter:
            inviter_id = inviter.id
        kwargs["inviter_id"] = inviter_id

        om = OrganizationMember.objects.create(**kwargs)

        if team_roles:
            for team, role in team_roles:
                Factories.create_team_membership(team=team, member=om, role=role)
        elif teams:
            for team in teams:
                Factories.create_team_membership(team=team, member=om, role=teamRole)
        return om

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_team_membership(team, member=None, user=None, role=None):
        if member is None:
            member, created = OrganizationMember.objects.get_or_create(
                user_id=user.id if user else None,
                organization=team.organization,
                defaults={"role": "member"},
            )

        return OrganizationMemberTeam.objects.create(
            team=team, organizationmember=member, is_active=True, role=role
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_api_key(organization, scope_list=None, **kwargs):
        return ApiKey.objects.create(organization_id=organization.id, scope_list=scope_list)

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_auth_provider(**kwargs):
        return AuthProvider.objects.create(**kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_auth_identity(**kwargs):
        return AuthIdentity.objects.create(**kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_user_auth_token(user, scope_list: list[str] | None = None, **kwargs) -> ApiToken:
        if scope_list is None:
            scope_list = []
        return ApiToken.objects.create(
            user=user,
            scope_list=scope_list,
            token_type=AuthTokenType.USER,
            **kwargs,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_org_auth_token(*args, **kwargs) -> OrgAuthToken:
        return OrgAuthToken.objects.create(*args, **kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_team(organization, **kwargs):
        if not kwargs.get("name"):
            kwargs["name"] = petname.generate(2, " ", letters=10).title()
        if not kwargs.get("slug"):
            kwargs["slug"] = slugify(str(kwargs["name"]))
        members = kwargs.pop("members", None)

        team = Team.objects.create(organization=organization, **kwargs)
        if members:
            for user in members:
                Factories.create_team_membership(team=team, user=user)
        return team

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_environment(project, **kwargs):
        name = kwargs.get("name", petname.generate(3, " ", letters=10)[:64])

        organization = kwargs.get("organization")
        organization_id = organization.id if organization else project.organization_id

        env = Environment.objects.create(organization_id=organization_id, name=name)
        env.add_project(project, is_hidden=kwargs.get("is_hidden"))
        return env

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_project(
        organization=None, teams=None, fire_project_created=False, **kwargs
    ) -> Project:
        if not kwargs.get("name"):
            kwargs["name"] = petname.generate(2, " ", letters=10).title()
        if not kwargs.get("slug"):
            kwargs["slug"] = slugify(str(kwargs["name"]))
        if not organization and teams:
            organization = teams[0].organization

        with transaction.atomic(router.db_for_write(Project)):
            project = Project.objects.create(organization=organization, **kwargs)
            if teams:
                for team in teams:
                    project.add_team(team)
            if fire_project_created:
                project_created.send(
                    project=project, user=AnonymousUser(), default_rules=True, sender=Factories
                )
        return project

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_project_template(project=None, organization=None, **kwargs) -> ProjectTemplate:
        if not kwargs.get("name"):
            kwargs["name"] = petname.generate(2, " ", letters=10).title()

        with transaction.atomic(router.db_for_write(Project)):
            project_template = ProjectTemplate.objects.create(organization=organization, **kwargs)

        return project_template

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_project_bookmark(project, user):
        return ProjectBookmark.objects.create(project_id=project.id, user_id=user.id)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_project_rule(
        project,
        action_data=None,
        allow_no_action_data=False,
        condition_data=None,
        name="",
        action_match="all",
        filter_match="all",
        **kwargs,
    ):
        actions = None
        if not allow_no_action_data:
            action_data = action_data or [
                {
                    "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                    "name": "Send a notification (for all legacy integrations)",
                },
                {
                    "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                    "service": "mail",
                    "name": "Send a notification via mail",
                },
            ]
            actions = action_data
        condition_data = condition_data or [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "name": "A new issue is created",
            },
            {
                "id": "sentry.rules.conditions.every_event.EveryEventCondition",
                "name": "The event occurs",
            },
        ]
        data = {
            "conditions": condition_data,
            "action_match": action_match,
            "filter_match": filter_match,
        }
        if actions:
            data["actions"] = actions

        return Rule.objects.create(
            label=name,
            project=project,
            data=data,
            **kwargs,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_slack_project_rule(project, integration_id, channel_id=None, channel_name=None):
        action_data = [
            {
                "id": "sentry.rules.actions.notify_event.SlackNotifyServiceAction",
                "name": "Send a Slack notification",
                "workspace": integration_id,
                "channel_id": channel_id or "123453",
                "channel": channel_name or "#general",
            }
        ]
        return Factories.create_project_rule(project, action_data)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_project_key(project):
        return project.key_set.get_or_create()[0]

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_tempest_credentials(
        project: Project,
        created_by: User | None = None,
        client_id: str | None = None,
        client_secret: str | None = None,
        message: str = "",
        message_type: str | None = None,
        latest_fetched_item_id: str | None = None,
    ):
        if client_id is None:
            client_id = str(uuid4())
        if client_secret is None:
            client_secret = str(uuid4())
        if message_type is None:
            message_type = TempestMessageType.ERROR

        return TempestCredentials.objects.create(
            project=project,
            created_by_id=created_by.id if created_by else None,
            client_id=client_id,
            client_secret=client_secret,
            message=message,
            message_type=message_type,
            latest_fetched_item_id=latest_fetched_item_id,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_release(
        project: Project,
        user: User | None = None,
        version: str | None = None,
        date_added: datetime | None = None,
        additional_projects: Sequence[Project] | None = None,
        environments: Sequence[Environment] | None = None,
        date_released: datetime | None = None,
        adopted: datetime | None = None,
        unadopted: datetime | None = None,
        status: int | None = ReleaseStatus.OPEN,
    ):
        if version is None:
            version = hexlify(os.urandom(20)).decode()

        if date_added is None:
            date_added = timezone.now()

        if additional_projects is None:
            additional_projects = []

        release = Release.objects.create(
            version=version,
            organization_id=project.organization_id,
            date_added=date_added,
            date_released=date_released,
            status=status,
        )

        release.add_project(project)
        for additional_project in additional_projects:
            release.add_project(additional_project)

        for environment in environments or []:
            ReleaseEnvironment.objects.create(
                organization=project.organization, release=release, environment=environment
            )
            for project in [project, *additional_projects]:
                ReleaseProjectEnvironment.objects.create(
                    project=project,
                    release=release,
                    environment=environment,
                    adopted=adopted,
                    unadopted=unadopted,
                )

        Activity.objects.create(
            type=ActivityType.RELEASE.value,
            project=project,
            ident=Activity.get_version_ident(version),
            user_id=user.id if user else None,
            data={"version": version},
        )

        # add commits
        if user:
            author = Factories.create_commit_author(project=project, user=user)
            repo = Factories.create_repo(project, name=f"organization-{project.slug}")
            commit = Factories.create_commit(
                project=project,
                repo=repo,
                author=author,
                release=release,
                key="deadbeef",
                message="placeholder commit message",
            )

            release.update(authors=[str(author.id)], commit_count=1, last_commit_id=commit.id)

        return release

    @staticmethod
    def create_group_release(project: Project, group: Group, release: Release) -> GroupRelease:
        return GroupRelease.objects.create(
            project_id=project.id,
            group_id=group.id,
            release_id=release.id,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_release_file(release_id, file=None, name=None, dist_id=None):
        if file is None:
            file = Factories.create_file(
                name="log.txt",
                size=32,
                headers={"Content-Type": "text/plain"},
                checksum="dc1e3f3e411979d336c3057cce64294f3420f93a",
            )

        if name is None:
            name = file.name

        organization_id = Release.objects.get(pk=release_id).organization.id

        return ReleaseFile.objects.create(
            organization_id=organization_id,
            release_id=release_id,
            name=name,
            file=file,
            dist_id=dist_id,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_artifact_bundle_zip(
        org=None, release=None, project=None, extra_files=None, fixture_path="artifact_bundle"
    ):
        bundle = io.BytesIO()
        bundle_dir = get_fixture_path(fixture_path)
        with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as zipf:
            for path, content in (extra_files or {}).items():
                zipf.writestr(path, content)
            for path, _, files in os.walk(bundle_dir):
                for filename in files:
                    fullpath = os.path.join(path, filename)
                    relpath = os.path.relpath(fullpath, bundle_dir)
                    if filename == "manifest.json":
                        manifest = _patch_artifact_manifest(
                            fullpath, org, release, project, extra_files
                        )
                        zipf.writestr(relpath, manifest)
                    else:
                        zipf.write(fullpath, relpath)

        return bundle.getvalue()

    @classmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_release_archive(cls, org, release: str, project=None, dist=None):
        bundle = cls.create_artifact_bundle_zip(org, release, project)
        file = File.objects.create(name="release-artifacts.zip")
        file.putfile(ContentFile(bundle))
        release_obj = Release.objects.get(organization__slug=org, version=release)
        return update_artifact_index(release_obj, dist, file)

    @classmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_artifact_bundle(
        cls,
        org,
        bundle_id=None,
        artifact_count=0,
        fixture_path="artifact_bundle_debug_ids",
        date_uploaded=None,
        date_last_modified=None,
    ):
        if date_uploaded is None:
            date_uploaded = timezone.now()

        bundle = cls.create_artifact_bundle_zip(org.slug, fixture_path=fixture_path)
        file_ = File.objects.create(name="artifact-bundle.zip")
        file_.putfile(ContentFile(bundle))
        # The 'artifact_count' should correspond to the 'bundle' contents but for the purpose of tests we can also
        # mock it with an arbitrary value.
        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=org.id,
            bundle_id=bundle_id or uuid4(),
            file=file_,
            artifact_count=artifact_count,
            date_uploaded=date_uploaded,
            date_last_modified=date_last_modified,
        )
        return artifact_bundle

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_code_mapping(project, repo=None, organization_integration=None, **kwargs):
        kwargs.setdefault("stack_root", "")
        kwargs.setdefault("source_root", "")
        kwargs.setdefault("default_branch", "master")

        if not repo:
            repo = Factories.create_repo(project=project)
        return RepositoryProjectPathConfig.objects.create(
            project=project,
            repository=repo,
            organization_integration_id=organization_integration.id,
            integration_id=organization_integration.integration_id,
            organization_id=organization_integration.organization_id,
            **kwargs,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_repo(
        project, name=None, provider=None, integration_id=None, url=None, external_id=None
    ):
        repo, _ = Repository.objects.get_or_create(
            organization_id=project.organization_id,
            name=name
            or "{}-{}".format(petname.generate(2, "", letters=10), random.randint(1000, 9999)),
            provider=provider,
            integration_id=integration_id,
            url=url,
            external_id=external_id,
        )
        return repo

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_commit(
        repo, project=None, author=None, release=None, message=None, key=None, date_added=None
    ):
        commit = Commit.objects.get_or_create(
            organization_id=repo.organization_id,
            repository_id=repo.id,
            key=key or sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            defaults={
                "message": message or make_sentence(),
                "author": author
                or Factories.create_commit_author(organization_id=repo.organization_id),
                "date_added": date_added or timezone.now(),
            },
        )[0]

        if release:
            assert project
            ReleaseCommit.objects.create(
                organization_id=repo.organization_id,
                project_id=project.id,
                release=release,
                commit=commit,
                order=1,
            )

        Factories.create_commit_file_change(commit=commit, filename="/models/foo.py")
        Factories.create_commit_file_change(commit=commit, filename="/worsematch/foo.py")
        Factories.create_commit_file_change(commit=commit, filename="/models/other.py")

        return commit

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_commit_author(organization_id=None, project=None, user=None, email=None):
        if email:
            user_email = email
        else:
            user_email = user.email if user else f"{make_word()}@example.com"
        return CommitAuthor.objects.get_or_create(
            organization_id=organization_id or project.organization_id,
            email=user_email,
            defaults={"name": user.name if user else make_word()},
        )[0]

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_commit_file_change(commit, filename):
        return CommitFileChange.objects.get_or_create(
            organization_id=commit.organization_id, commit=commit, filename=filename, type="M"
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_user(
        email=None, is_superuser=False, is_staff=False, is_active=True, **kwargs
    ) -> User:
        if email is None:
            email = uuid4().hex + "@example.com"

        kwargs.setdefault("username", email)

        user = User(
            email=email, is_superuser=is_superuser, is_staff=is_staff, is_active=is_active, **kwargs
        )
        if kwargs.get("password") is None:
            user.set_password("admin")
        user.save()

        # UserEmail is created by a signal
        assert UserEmail.objects.filter(user=user, email=email).update(is_verified=True)

        return user

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_useremail(user, email=None, **kwargs):
        if not email:
            email = uuid4().hex + "@example.com"

        kwargs.setdefault("is_verified", True)

        useremail = UserEmail(user=user, email=email, **kwargs)
        useremail.save()

        return useremail

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_user_avatar(*args, **kwargs):
        return UserAvatar.objects.create(*args, **kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_user_role(*args, **kwargs):
        return UserRole.objects.create(*args, **kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_usersocialauth(
        user: User,
        provider: str | None = None,
        uid: str | None = None,
        extra_data: dict[str, Any] | None = None,
    ):
        if not provider:
            provider = "asana"
        if not uid:
            uid = "abc-123"
        usa = UserSocialAuth(user=user, provider=provider, uid=uid, extra_data=extra_data)
        usa.save()
        return usa

    @staticmethod
    def inject_performance_problems(jobs, _):
        for job in jobs:
            job["performance_problems"] = []
            for f in job["data"]["fingerprint"]:
                f_data = f.split("-", 1)
                if len(f_data) < 2:
                    raise ValueError(
                        "Invalid performance fingerprint data. Format must be 'group_type-fingerprint'."
                    )
                group_type = get_group_type_by_type_id(int(f_data[0]))
                perf_fingerprint = f_data[1]

                job["performance_problems"].append(
                    PerformanceProblem(
                        fingerprint=perf_fingerprint,
                        op="db",
                        desc="",
                        type=group_type,
                        parent_span_ids=None,
                        cause_span_ids=None,
                        offender_span_ids=[],
                        evidence_data={},
                        evidence_display=[],
                    )
                )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def store_event(
        data,
        project_id: int,
        assert_no_errors: bool = True,
        default_event_type: EventType | None = None,
        sent_at: datetime | None = None,
    ) -> GroupEvent:
        """
        Like `create_event`, but closer to how events are actually
        ingested. Prefer to use this method over `create_event`
        """

        # this creates a basic message event
        if default_event_type == EventType.DEFAULT:
            data.update({"stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"])})

        # this creates an error event
        elif default_event_type == EventType.ERROR:
            data.update({"exception": [{"value": "BadError"}]})

        manager = EventManager(data, sent_at=sent_at)
        manager.normalize()
        if assert_no_errors:
            errors = manager.get_data().get("errors")
            assert not errors, errors

        normalized_data = manager.get_data()
        event = None

        # When fingerprint is present on transaction, inject performance problems
        if (
            normalized_data.get("type") == "transaction"
            and normalized_data.get("fingerprint") is not None
        ):
            with mock.patch(
                "sentry.event_manager._detect_performance_problems",
                Factories.inject_performance_problems,
            ):
                event = manager.save(project_id)

        else:
            event = manager.save(project_id)

        if event.groups:
            for group in event.groups:
                group.save()

        if event.group:
            event.group.save()

        return event

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_group(project, **kwargs):
        from sentry.models.group import GroupStatus
        from sentry.types.group import GroupSubStatus

        kwargs.setdefault("message", "Hello world")
        kwargs.setdefault("data", {})
        if "type" not in kwargs["data"]:
            kwargs["data"].update({"type": "default", "metadata": {"title": kwargs["message"]}})
        if "short_id" not in kwargs:
            kwargs["short_id"] = project.next_short_id()
        if "metadata" in kwargs:
            metadata = kwargs.pop("metadata")
            kwargs["data"].setdefault("metadata", {}).update(metadata)
        if "status" not in kwargs:
            kwargs["status"] = GroupStatus.UNRESOLVED
            kwargs["substatus"] = GroupSubStatus.NEW

        return Group.objects.create(project=project, **kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_file(**kwargs):
        return File.objects.create(**kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_file_from_path(path, name=None, **kwargs):
        if name is None:
            name = os.path.basename(path)

        file = Factories.create_file(name=name, **kwargs)
        with open(path) as f:
            file.putfile(f)
        return file

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_event_attachment(event, file=None, **kwargs):
        if file is None:
            file = Factories.create_file(
                name="log.txt",
                size=32,
                headers={"Content-Type": "text/plain"},
                checksum="dc1e3f3e411979d336c3057cce64294f3420f93a",
            )

        return EventAttachment.objects.create(
            project_id=event.project_id,
            event_id=event.event_id,
            file_id=file.id,
            type=file.type,
            **kwargs,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_dif_file(
        project,
        debug_id=None,
        object_name=None,
        features=None,
        data=None,
        file=None,
        cpu_name=None,
        code_id=None,
        **kwargs,
    ):
        if debug_id is None:
            debug_id = str(uuid4())

        if object_name is None:
            object_name = "%s.dSYM" % debug_id

        if features is not None:
            if data is None:
                data = {}
            data["features"] = features

        if file is None:
            file = Factories.create_file(
                name=object_name,
                size=42,
                headers={"Content-Type": "application/x-mach-binary"},
                checksum="dc1e3f3e411979d336c3057cce64294f3420f93a",
            )

        return ProjectDebugFile.objects.create(
            debug_id=debug_id,
            code_id=code_id,
            project_id=project.id,
            object_name=object_name,
            cpu_name=cpu_name or "x86_64",
            file=file,
            checksum=file.checksum,
            data=data,
            **kwargs,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_dif_from_path(path, object_name=None, **kwargs):
        if object_name is None:
            object_name = os.path.basename(path)

        headers = {"Content-Type": "application/x-mach-binary"}
        file = Factories.create_file_from_path(path, name=object_name, headers=headers)
        return Factories.create_dif_file(file=file, object_name=object_name, **kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def add_user_permission(user, permission):
        UserPermission.objects.create(user=user, permission=permission)

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_sentry_app(**kwargs):
        published = kwargs.pop("published", False)
        args = Factories._sentry_app_kwargs(**kwargs)
        user = args.pop("user", None)
        app = SentryAppCreator(is_internal=False, **args).run(user=user, request=None)

        if published:
            app.update(status=SentryAppStatus.PUBLISHED)

        return app

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_sentry_app_avatar(*args, **kwargs):
        return SentryAppAvatar.objects.create(*args, **kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_internal_integration(**kwargs) -> SentryApp:
        args = Factories._sentry_app_kwargs(**kwargs)
        args["verify_install"] = False
        user = args.pop("user", None)
        app = SentryAppCreator(is_internal=True, **args).run(
            user=user, request=None, skip_default_auth_token=True
        )
        return app

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_internal_integration_token(
        user,
        internal_integration: SentryApp | None = None,
        install: SentryAppInstallation | None = None,
        request=None,
    ) -> ApiToken:
        if internal_integration and install:
            raise ValueError("Only one of internal_integration or install arg can be provided")
        elif internal_integration is None and install is None:
            raise ValueError("Must pass in either internal_integration or install arg")

        if internal_integration is not None and install is None:
            # Fetch install from provided or created internal integration
            with assume_test_silo_mode(SiloMode.CONTROL):
                install = SentryAppInstallation.objects.get(
                    sentry_app=internal_integration.id,
                    organization_id=internal_integration.owner_id,
                )
        elif install is None:
            raise AssertionError("unreachable")

        return SentryAppInstallationTokenCreator(sentry_app_installation=install).run(
            user=user, request=request
        )

    @staticmethod
    def _sentry_app_kwargs(**kwargs):
        _kwargs = {
            "user": kwargs.get("user", Factories.create_user()),
            "name": kwargs.get("name", petname.generate(2, " ", letters=10).title()),
            "organization_id": kwargs.get(
                "organization_id", kwargs.pop("organization", Factories.create_organization()).id
            ),
            "author": kwargs.get("author", "A Company"),
            "scopes": kwargs.get("scopes", ()),
            "verify_install": kwargs.get("verify_install", True),
            "webhook_url": kwargs.get("webhook_url", "https://example.com/webhook"),
            "events": [],
            "schema": {},
        }

        _kwargs.update(**kwargs)
        return _kwargs

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_sentry_app_installation(
        organization=None,
        slug=None,
        user=None,
        status=None,
        prevent_token_exchange=False,
    ):
        if not organization:
            organization = Factories.create_organization()

        Factories.create_project(organization=organization)

        with assume_test_silo_mode(SiloMode.CONTROL):
            install = SentryAppInstallationCreator(
                slug=(slug or Factories.create_sentry_app(organization=organization).slug),
                organization_id=organization.id,
            ).run(
                user=(user or Factories.create_user()),
                request=None,
            )

            install.status = SentryAppInstallationStatus.INSTALLED if status is None else status
            install.save()
            rpc_install = serialize_sentry_app_installation(install, install.sentry_app)
            if not prevent_token_exchange and (
                install.sentry_app.status != SentryAppStatus.INTERNAL
            ):
                assert install.api_grant is not None
                assert install.sentry_app.application is not None
                assert install.sentry_app.proxy_user is not None
                GrantExchanger(
                    install=rpc_install,
                    code=install.api_grant.code,
                    client_id=install.sentry_app.application.client_id,
                    user=install.sentry_app.proxy_user,
                ).run()
                install = SentryAppInstallation.objects.get(id=install.id)
        return install

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_sentry_app_installation_for_provider(
        sentry_app_id: int,
        organization_id: int,
        provider: str,
    ) -> SentryAppInstallationForProvider:
        installation = SentryAppInstallation.objects.get(
            sentry_app_id=sentry_app_id, organization_id=organization_id
        )
        return SentryAppInstallationForProvider.objects.create(
            organization_id=organization_id,
            provider=provider,
            sentry_app_installation=installation,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_stacktrace_link_schema():
        return {"type": "stacktrace-link", "uri": "/redirect/"}

    @staticmethod
    def create_issue_link_schema():
        return {
            "type": "issue-link",
            "link": {
                "uri": "/sentry/issues/link",
                "required_fields": [
                    {
                        "type": "select",
                        "name": "assignee",
                        "label": "Assignee",
                        "uri": "/sentry/members",
                    }
                ],
            },
            "create": {
                "uri": "/sentry/issues/create",
                "required_fields": [
                    {"type": "text", "name": "title", "label": "Title"},
                    {"type": "text", "name": "summary", "label": "Summary"},
                ],
                "optional_fields": [
                    {
                        "type": "select",
                        "name": "points",
                        "label": "Points",
                        "options": [["1", "1"], ["2", "2"], ["3", "3"], ["5", "5"], ["8", "8"]],
                    },
                    {
                        "type": "select",
                        "name": "assignee",
                        "label": "Assignee",
                        "uri": "/sentry/members",
                    },
                ],
            },
        }

    @staticmethod
    def create_alert_rule_action_schema():
        return {
            "type": "alert-rule-action",
            "title": "Create Task with App",
            "settings": {
                "type": "alert-rule-settings",
                "uri": "/sentry/alert-rule",
                "required_fields": [
                    {"type": "text", "name": "title", "label": "Title"},
                    {"type": "text", "name": "summary", "label": "Summary"},
                ],
                "optional_fields": [
                    {
                        "type": "select",
                        "name": "points",
                        "label": "Points",
                        "options": [["1", "1"], ["2", "2"], ["3", "3"], ["5", "5"], ["8", "8"]],
                    },
                    {
                        "type": "select",
                        "name": "assignee",
                        "label": "Assignee",
                        "uri": "/sentry/members",
                    },
                ],
            },
        }

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_service_hook(actor=None, org=None, project=None, events=None, url=None, **kwargs):
        if not actor:
            actor = Factories.create_user()
        if not org:
            if project:
                org = project.organization
            else:
                org = Factories.create_organization(owner=actor)
        if not project:
            project = Factories.create_project(organization=org)
        if events is None:
            events = ["event.created"]
        if not url:
            url = "https://example.com/sentry/webhook"

        app_id = kwargs.pop("application_id", None)
        if app_id is None and "application" in kwargs:
            app_id = kwargs["application"].id
        installation_id = kwargs.pop("installation_id", None)
        if installation_id is None and "installation" in kwargs:
            installation_id = kwargs["installation"].id
        hook_id = hook_service.create_service_hook(
            application_id=app_id,
            actor_id=actor.id,
            installation_id=installation_id,
            organization_id=org.id,
            project_ids=[project.id],
            events=events,
            url=url,
        ).id
        return ServiceHook.objects.get(id=hook_id)

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_sentry_app_feature(feature=None, sentry_app=None, description=None):
        if not sentry_app:
            sentry_app = Factories.create_sentry_app()

        integration_feature = IntegrationFeature.objects.create(
            target_id=sentry_app.id,
            target_type=IntegrationTypes.SENTRY_APP.value,
            feature=feature or Feature.API,
        )

        if description:
            integration_feature.update(user_description=description)

        return integration_feature

    @staticmethod
    def _doc_integration_kwargs(**kwargs):
        _kwargs = {
            "name": kwargs.get("name", petname.generate(2, " ", letters=10).title()),
            "author": kwargs.get("author", "me"),
            "description": kwargs.get("description", "hi im a description"),
            "url": kwargs.get("url", "https://sentry.io"),
            "popularity": kwargs.get("popularity", 1),
            "is_draft": kwargs.get("is_draft", True),
            "metadata": kwargs.get("metadata", {}),
        }
        _kwargs["slug"] = slugify(_kwargs["name"])
        _kwargs.update(**kwargs)
        return _kwargs

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_doc_integration(features=None, has_avatar: bool = False, **kwargs) -> DocIntegration:
        doc = DocIntegration.objects.create(**Factories._doc_integration_kwargs(**kwargs))
        if features:
            Factories.create_doc_integration_features(features=features, doc_integration=doc)
        if has_avatar:
            Factories.create_doc_integration_avatar(doc_integration=doc)
        return doc

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_doc_integration_features(
        features=None, doc_integration=None
    ) -> list[IntegrationFeature]:
        if not features:
            features = [Feature.API]
        if not doc_integration:
            doc_integration = Factories.create_doc_integration()
        return IntegrationFeature.objects.bulk_create(
            [
                IntegrationFeature(
                    target_id=doc_integration.id,
                    target_type=IntegrationTypes.DOC_INTEGRATION.value,
                    feature=feature,
                )
                for feature in features
            ]
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_doc_integration_avatar(doc_integration=None, **kwargs) -> DocIntegrationAvatar:
        if not doc_integration:
            doc_integration = Factories.create_doc_integration()
        photo = ControlFile.objects.create(name="test.png", type="avatar.file")
        photo.putfile(io.BytesIO(b"imaginethiswasphotobytes"))

        return DocIntegrationAvatar.objects.create(
            doc_integration=doc_integration, avatar_type=0, control_file_id=photo.id
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_userreport(
        project: Project, event_id: str | None = None, **kwargs: Any
    ) -> UserReport:
        event = Factories.store_event(
            data={
                "timestamp": datetime.now(UTC).isoformat(),
                "event_id": event_id or "a" * 32,
                "message": "testing",
            },
            project_id=project.id,
        )
        assert event.group is not None

        return UserReport.objects.create(
            group_id=event.group.id,
            event_id=event.event_id,
            project_id=project.id,
            name="Jane Bloggs",
            email="jane@example.com",
            comments="the application crashed",
            **kwargs,
        )

    @staticmethod
    def create_session():
        engine = import_module(settings.SESSION_ENGINE)

        session = engine.SessionStore()
        session.save()
        return session

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_platform_external_issue(
        group=None, service_type=None, display_name=None, web_url=None
    ):
        return PlatformExternalIssue.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            service_type=service_type,
            display_name=display_name,
            web_url=web_url,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_integration_external_issue(group=None, integration=None, key=None, **kwargs):
        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=integration.id, key=key, **kwargs
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        return external_issue

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_integration_external_project(
        organization_id: int, integration_id: int, *args: Any, **kwargs: Any
    ) -> IntegrationExternalProject:
        oi = OrganizationIntegration.objects.get(
            organization_id=organization_id, integration_id=integration_id
        )
        return IntegrationExternalProject.objects.create(
            organization_integration_id=oi.id, *args, **kwargs
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_incident(
        organization,
        projects,
        detection_uuid=None,
        status=1,
        title=None,
        query="test query",
        date_started=None,
        date_detected=None,
        date_closed=None,
        alert_rule=None,
        subscription=None,
    ):
        if not title:
            title = petname.generate(2, " ", letters=10).title()
        if alert_rule is None:
            alert_rule = Factories.create_alert_rule(
                organization, projects, query=query, time_window=1
            )

        incident = Incident.objects.create(
            organization=organization,
            detection_uuid=detection_uuid,
            status=status,
            title=title,
            alert_rule=alert_rule,
            date_started=date_started or timezone.now(),
            date_detected=date_detected or timezone.now(),
            date_closed=timezone.now() if date_closed is not None else date_closed,
            type=IncidentType.ALERT_TRIGGERED.value,
            subscription=subscription,
        )
        for project in projects:
            IncidentProject.objects.create(incident=incident, project=project)

        return incident

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_incident_activity(incident, type, comment=None, user_id=None):
        return IncidentActivity.objects.create(
            incident=incident, type=type, comment=comment, user_id=user_id
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_alert_rule(
        organization,
        projects,
        name=None,
        owner=None,
        query="level:error",
        aggregate="count()",
        time_window=10,
        threshold_period=1,
        environment=None,
        date_added=None,
        query_type=None,
        dataset=Dataset.Events,
        threshold_type=AlertRuleThresholdType.ABOVE,
        resolve_threshold=None,
        user=None,
        event_types=None,
        comparison_delta=None,
        description=None,
        sensitivity=None,
        seasonality=None,
        detection_type=AlertRuleDetectionType.STATIC,
    ):
        if not name:
            name = petname.generate(2, " ", letters=10).title()

        if query_type is None:
            query_type = query_datasets_to_type[dataset]

        alert_rule = create_alert_rule(
            organization,
            projects,
            name,
            query,
            aggregate,
            time_window,
            threshold_type,
            threshold_period,
            owner=owner,
            resolve_threshold=resolve_threshold,
            query_type=query_type,
            dataset=dataset,
            environment=environment,
            user=user,
            event_types=event_types,
            comparison_delta=comparison_delta,
            description=description,
            sensitivity=sensitivity,
            seasonality=seasonality,
            detection_type=detection_type,
        )

        if date_added is not None:
            alert_rule.update(date_added=date_added)

        return alert_rule

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_alert_rule_trigger(alert_rule, label=None, alert_threshold=100):
        if not label:
            label = petname.generate(2, " ", letters=10).title()

        return create_alert_rule_trigger(alert_rule, label, alert_threshold)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_incident_trigger(incident, alert_rule_trigger, status=None):
        if status is None:
            status = TriggerStatus.ACTIVE.value

        return IncidentTrigger.objects.create(
            alert_rule_trigger=alert_rule_trigger, incident=incident, status=status
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_alert_rule_trigger_action(
        trigger,
        type=AlertRuleTriggerAction.Type.EMAIL,
        target_type=AlertRuleTriggerAction.TargetType.USER,
        target_identifier=None,
        integration=None,
        sentry_app=None,
        sentry_app_config=None,
    ):
        return create_alert_rule_trigger_action(
            trigger,
            type,
            target_type,
            target_identifier,
            integration.id if integration else None,
            sentry_app.id if sentry_app else None,
            sentry_app_config=sentry_app_config,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_external_user(user: User, **kwargs: Any) -> ExternalActor:
        kwargs.setdefault("provider", ExternalProviders.GITHUB.value)
        kwargs.setdefault("external_name", "")

        return ExternalActor.objects.create(user_id=user.id, **kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_external_team(team: Team, **kwargs: Any) -> ExternalActor:
        kwargs.setdefault("provider", ExternalProviders.GITHUB.value)
        kwargs.setdefault("external_name", "@getsentry/ecosystem")

        return ExternalActor.objects.create(team_id=team.id, **kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_codeowners(project, code_mapping, **kwargs):
        kwargs.setdefault("raw", "")

        return ProjectCodeOwners.objects.create(
            project=project, repository_project_path_config=code_mapping, **kwargs
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_slack_integration(
        organization: Organization, external_id: str, **kwargs: Any
    ) -> Integration:
        integration = Integration.objects.create(
            provider="slack",
            name="Team A",
            external_id=external_id,
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        integration.add_organization(organization)
        return integration

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_integration(
        organization: Organization,
        external_id: str,
        oi_params: Mapping[str, Any] | None = None,
        **integration_params: Any,
    ) -> Integration:
        integration = Integration.objects.create(external_id=external_id, **integration_params)
        with outbox_runner():
            organization_integration = integration.add_organization(organization)
            assert organization_integration is not None
        organization_integration.update(**(oi_params or {}))

        return integration

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_provider_integration(**integration_params: Any) -> Integration:
        return Integration.objects.create(**integration_params)

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_provider_integration_for(
        organization: Organization | RpcOrganization,
        user: User | RpcUser | None,
        **integration_params: Any,
    ) -> tuple[Integration, OrganizationIntegration]:
        integration = Integration.objects.create(**integration_params)
        org_integration = integration.add_organization(organization, user)
        assert org_integration is not None
        return integration, org_integration

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_identity_integration(
        user: User | RpcUser,
        organization: Organization | RpcOrganization,
        integration_params: Mapping[Any, Any],
        identity_params: Mapping[Any, Any],
    ) -> tuple[Integration, OrganizationIntegration, Identity, IdentityProvider]:
        # Avoid common pitfalls in tests
        assert "provider" in integration_params
        assert "external_id" in integration_params
        assert "external_id" in identity_params

        integration = Factories.create_provider_integration(**integration_params)
        identity_provider = Factories.create_identity_provider(integration=integration)
        identity = Factories.create_identity(
            user=user, identity_provider=identity_provider, **identity_params
        )
        organization_integration = integration.add_organization(
            organization_id=organization.id, user=user, default_auth_id=identity.id
        )
        assert organization_integration is not None
        return integration, organization_integration, identity, identity_provider

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_organization_integration(**integration_params: Any) -> OrganizationIntegration:
        return OrganizationIntegration.objects.create(**integration_params)

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_identity_provider(
        integration: Integration | None = None,
        config: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> IdentityProvider:
        if integration is not None:
            integration_values = dict(
                type=integration.provider,
                external_id=integration.external_id,
            )
            if any((key in kwargs) for key in integration_values):
                raise ValueError(
                    "Values from integration should not be in kwargs: "
                    + repr(list(integration_values.keys()))
                )
            kwargs.update(integration_values)

        return IdentityProvider.objects.create(config=config or {}, **kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_identity(
        user: User | RpcUser, identity_provider: IdentityProvider, external_id: str, **kwargs: Any
    ) -> Identity:
        return Identity.objects.create(
            external_id=external_id,
            idp=identity_provider,
            user_id=user.id,
            status=IdentityStatus.VALID,
            scopes=[],
            **kwargs,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_group_history(
        group: Group,
        status: int,
        release: Release | None = None,
        user_id: int | None = None,
        team_id: int | None = None,
        prev_history: GroupHistory | None = None,
        date_added: datetime | None = None,
    ) -> GroupHistory:
        prev_history_date = None
        if prev_history:
            prev_history_date = prev_history.date_added

        kwargs = {}
        if date_added:
            kwargs["date_added"] = date_added
        return GroupHistory.objects.create(
            organization=group.organization,
            group=group,
            project=group.project,
            release=release,
            user_id=user_id,
            team_id=team_id,
            status=status,
            prev_history=prev_history,
            prev_history_date=prev_history_date,
            **kwargs,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_comment(issue, project, user, text="hello world"):
        data = {"text": text}
        return Activity.objects.create(
            project=project,
            group=issue,
            type=ActivityType.NOTE.value,
            user_id=user.id,
            data=data,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_saved_search(name: str, **kwargs):
        if "owner" in kwargs:
            owner = kwargs.pop("owner")
            kwargs["owner_id"] = owner.id if not isinstance(owner, int) else owner
        return SavedSearch.objects.create(name=name, **kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_notification_action(
        organization: Organization | None = None,
        projects: list[Project] | None = None,
        **kwargs,
    ):
        if not organization:
            organization = Factories.create_organization()

        if not projects:
            projects = []

        action_kwargs = {
            "organization": organization,
            "type": ActionService.SENTRY_NOTIFICATION,
            "target_type": ActionTarget.USER,
            "target_identifier": "1",
            "target_display": "Sentry User",
            "trigger_type": ActionTrigger.AUDIT_LOG,
            **kwargs,
        }

        action = NotificationAction.objects.create(**action_kwargs)
        action.projects.add(*projects)
        action.save()

        return action

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_notification_settings_provider(*args, **kwargs) -> NotificationSettingProvider:
        return NotificationSettingProvider.objects.create(*args, **kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_user_option(*args, **kwargs) -> UserOption:
        return UserOption.objects.create(*args, **kwargs)

    @staticmethod
    def create_basic_auth_header(username: str, password: str = "") -> bytes:
        return b"Basic " + b64encode(f"{username}:{password}".encode())

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def snooze_rule(**kwargs):
        return RuleSnooze.objects.create(**kwargs)

    @staticmethod
    def create_request_access(
        sso_state: RpcMemberSsoState | None = None,
        permissions: list | None = None,
        org_context: RpcUserOrganizationContext | None = None,
        scopes_upper_bound: frozenset | None = frozenset(),
    ) -> RpcBackedAccess:
        if not sso_state:
            sso_state = RpcMemberSsoState()
        if not permissions:
            permissions = []
        if not org_context:
            org_context = RpcUserOrganizationContext()

        auth_state = RpcAuthState(sso_state=sso_state, permissions=permissions)
        return RpcBackedAccess(
            rpc_user_organization_context=org_context,
            auth_state=auth_state,
            scopes_upper_bound=scopes_upper_bound,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_webhook_payload(mailbox_name: str, region_name: str, **kwargs) -> WebhookPayload:
        payload_kwargs = {
            "request_method": "POST",
            "request_path": "/extensions/github/webhook/",
            "request_headers": '{"Content-Type": "application/json"}',
            "request_body": "{}",
            **kwargs,
        }
        return WebhookPayload.objects.create(
            mailbox_name=mailbox_name, region_name=region_name, **payload_kwargs
        )

    @staticmethod
    def create_uptime_subscription(
        type: str,
        subscription_id: str | None,
        status: UptimeSubscription.Status,
        url: str | None,
        url_domain: str,
        url_domain_suffix: str,
        host_provider_id: str,
        interval_seconds: IntervalSecondsLiteral,
        timeout_ms: int,
        method,
        headers,
        body,
        date_updated: datetime,
        trace_sampling: bool = False,
    ):
        if url is None:
            url = petname.generate().title()
            url = f"http://{url}.com"

        return UptimeSubscription.objects.create(
            type=type,
            subscription_id=subscription_id,
            status=status.value,
            url=url,
            url_domain=url_domain,
            url_domain_suffix=url_domain_suffix,
            host_provider_id=host_provider_id,
            interval_seconds=interval_seconds,
            timeout_ms=timeout_ms,
            date_updated=date_updated,
            method=method,
            headers=headers,
            body=body,
            trace_sampling=trace_sampling,
        )

    @staticmethod
    def create_project_uptime_subscription(
        project: Project,
        env: Environment | None,
        uptime_subscription: UptimeSubscription,
        mode: ProjectUptimeSubscriptionMode,
        name: str | None,
        owner: Actor | None,
        uptime_status: UptimeStatus,
    ):
        if name is None:
            name = petname.generate().title()
        owner_team_id = None
        owner_user_id = None
        if owner:
            if owner.is_team:
                owner_team_id = owner.id
            elif owner.is_user:
                owner_user_id = owner.id

        return ProjectUptimeSubscription.objects.create(
            uptime_subscription=uptime_subscription,
            project=project,
            environment=env,
            mode=mode,
            name=name,
            owner_team_id=owner_team_id,
            owner_user_id=owner_user_id,
            uptime_status=uptime_status,
        )

    @staticmethod
    def create_uptime_subscription_region(
        subscription: UptimeSubscription, region_slug: str
    ) -> UptimeSubscriptionRegion:
        return UptimeSubscriptionRegion.objects.create(
            uptime_subscription=subscription, region_slug=region_slug
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_dashboard(
        organization: Organization | None = None,
        title: str | None = None,
        created_by: User | None = None,
        **kwargs,
    ):
        if organization is None:
            organization = Factories.create_organization()
        if created_by is None:
            created_by = Factories.create_user()
            Factories.create_member(organization=organization, user=created_by, role="owner")
        if title is None:
            title = petname.generate(2, " ", letters=10).title()
        return Dashboard.objects.create(
            organization=organization, title=title, created_by_id=created_by.id, **kwargs
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_dashboard_widget(
        order: int,
        dashboard: Dashboard | None = None,
        title: str | None = None,
        display_type: int | None = None,
        **kwargs,
    ):
        if dashboard is None:
            dashboard = Factories.create_dashboard()
        if display_type is None:
            display_type = DashboardWidgetDisplayTypes.AREA_CHART
        if title is None:
            title = petname.generate(2, " ", letters=10).title()

        return DashboardWidget.objects.create(
            dashboard=dashboard, title=title, display_type=display_type, order=order, **kwargs
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_dashboard_widget_query(
        order: int,
        widget: DashboardWidget | None = None,
        name: str | None = None,
        **kwargs,
    ):
        if widget is None:
            widget = Factories.create_dashboard_widget(order=order)
        if name is None:
            name = petname.generate(2, " ", letters=10).title()
        return DashboardWidgetQuery.objects.create(widget=widget, name=name, order=order, **kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_workflow(
        name: str | None = None,
        organization: Organization | None = None,
        config: dict[str, Any] | None = None,
        **kwargs,
    ) -> Workflow:
        if organization is None:
            organization = Factories.create_organization()
        if name is None:
            name = petname.generate(2, " ", letters=10).title()
        if config is None:
            config = {}
        return Workflow.objects.create(
            organization=organization, name=name, config=config, **kwargs
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_data_condition_group(
        **kwargs,
    ) -> DataConditionGroup:
        return DataConditionGroup.objects.create(**kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_workflow_data_condition_group(
        workflow: Workflow | None = None,
        condition_group: DataConditionGroup | None = None,
        **kwargs,
    ) -> WorkflowDataConditionGroup:
        if workflow is None:
            workflow = Factories.create_workflow()

        if not condition_group:
            condition_group = Factories.create_data_condition_group()

        return WorkflowDataConditionGroup.objects.create(
            workflow=workflow, condition_group=condition_group
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_data_condition(**kwargs) -> DataCondition:
        return DataCondition.objects.create(**kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_data_source(
        organization: Organization | None = None,
        query_id: int | None = None,
        type: str | None = None,
        **kwargs,
    ) -> DataSource:
        if organization is None:
            organization = Factories.create_organization()
        if query_id is None:
            query_id = random.randint(1, 10000)
        if type is None:
            type = data_source_type_registry.get_key(QuerySubscriptionDataSourceHandler)
        return DataSource.objects.create(organization=organization, query_id=query_id, type=type)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_detector(
        name: str | None = None,
        config: dict | None = None,
        **kwargs,
    ) -> Detector:
        if name is None:
            name = petname.generate(2, " ", letters=10).title()
        if config is None:
            config = {}

        return Detector.objects.create(
            name=name,
            config=config,
            **kwargs,
        )

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_detector_state(
        detector: Detector | None = None,
        **kwargs,
    ) -> DetectorState:
        if detector is None:
            detector = Factories.create_detector()

        return DetectorState.objects.create(detector=detector, **kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_data_source_detector(
        data_source: DataSource | None = None,
        detector: Detector | None = None,
        **kwargs,
    ) -> DataSourceDetector:
        if data_source is None:
            data_source = Factories.create_data_source()
        if detector is None:
            detector = Factories.create_detector()
        return DataSourceDetector.objects.create(data_source=data_source, detector=detector)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_action(**kwargs) -> Action:
        return Action.objects.create(**kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_detector_workflow(
        detector: Detector | None = None,
        workflow: Workflow | None = None,
        **kwargs,
    ) -> DetectorWorkflow:
        if detector is None:
            detector = Factories.create_detector()
        if workflow is None:
            workflow = Factories.create_workflow()
        return DetectorWorkflow.objects.create(detector=detector, workflow=workflow, **kwargs)

    @staticmethod
    @assume_test_silo_mode(SiloMode.REGION)
    def create_data_condition_group_action(
        action: Action | None = None,
        condition_group: DataConditionGroup | None = None,
        **kwargs,
    ) -> DataConditionGroupAction:
        if action is None:
            action = Factories.create_action()
        if condition_group is None:
            condition_group = Factories.create_data_condition_group()
        return DataConditionGroupAction.objects.create(
            action=action, condition_group=condition_group, **kwargs
        )
