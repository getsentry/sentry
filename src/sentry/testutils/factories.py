import io
import os
import random
import warnings
from binascii import hexlify
from datetime import datetime
from hashlib import sha1
from importlib import import_module
from typing import Any, List, Optional, Sequence
from uuid import uuid4

import petname
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_text
from django.utils.text import slugify

from sentry.constants import SentryAppInstallationStatus, SentryAppStatus
from sentry.event_manager import EventManager
from sentry.incidents.logic import (
    create_alert_rule,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
)
from sentry.incidents.models import (
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
    Incident,
    IncidentActivity,
    IncidentProject,
    IncidentSeen,
    IncidentTrigger,
    IncidentType,
    TriggerStatus,
)
from sentry.mediators import (
    sentry_app_installation_tokens,
    sentry_app_installations,
    sentry_apps,
    service_hooks,
)
from sentry.models import (
    Activity,
    Actor,
    Commit,
    CommitAuthor,
    CommitFileChange,
    DocIntegration,
    DocIntegrationAvatar,
    Environment,
    EventAttachment,
    ExternalActor,
    ExternalIssue,
    File,
    Group,
    GroupHistory,
    GroupLink,
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    IntegrationFeature,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    PlatformExternalIssue,
    Project,
    ProjectBookmark,
    ProjectCodeOwners,
    ProjectDebugFile,
    Release,
    ReleaseCommit,
    ReleaseEnvironment,
    ReleaseFile,
    ReleaseProjectEnvironment,
    Repository,
    RepositoryProjectPathConfig,
    Rule,
    Team,
    User,
    UserEmail,
    UserPermission,
    UserReport,
)
from sentry.models.integrations.integration_feature import Feature, IntegrationTypes
from sentry.models.releasefile import update_artifact_index
from sentry.signals import project_created
from sentry.snuba.models import QueryDatasets
from sentry.types.integrations import ExternalProviders
from sentry.utils import json, loremipsum


def get_fixture_path(name):
    return os.path.join(
        os.path.dirname(__file__),  # src/sentry/testutils/
        os.pardir,  # src/sentry/
        os.pardir,  # src/
        os.pardir,
        "tests",
        "fixtures",
        name,
    )


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


def _patch_artifact_manifest(path, org, release, project=None, extra_files=None):
    with open(path, "rb") as fp:
        manifest = json.load(fp)
    manifest["org"] = org
    manifest["release"] = release
    if project:
        manifest["project"] = project
    for path in extra_files or {}:
        manifest["files"][path] = {"url": path}
    return json.dumps(manifest)


# TODO(dcramer): consider moving to something more scalable like factoryboy
class Factories:
    @staticmethod
    def create_organization(name=None, owner=None, **kwargs):
        if not name:
            name = petname.Generate(2, " ", letters=10).title()

        org = Organization.objects.create(name=name, **kwargs)
        if owner:
            Factories.create_member(organization=org, user=owner, role="owner")
        return org

    @staticmethod
    def create_member(teams=None, **kwargs):
        kwargs.setdefault("role", "member")

        om = OrganizationMember.objects.create(**kwargs)
        if teams:
            for team in teams:
                Factories.create_team_membership(team=team, member=om)
        return om

    @staticmethod
    def create_team_membership(team, member=None, user=None):
        if member is None:
            member, _ = OrganizationMember.objects.get_or_create(
                user=user, organization=team.organization, defaults={"role": "member"}
            )

        return OrganizationMemberTeam.objects.create(
            team=team, organizationmember=member, is_active=True
        )

    @staticmethod
    def create_team(organization, **kwargs):
        if not kwargs.get("name"):
            kwargs["name"] = petname.Generate(2, " ", letters=10).title()
        if not kwargs.get("slug"):
            kwargs["slug"] = slugify(str(kwargs["name"]))
        members = kwargs.pop("members", None)

        team = Team.objects.create(organization=organization, **kwargs)
        if members:
            for user in members:
                Factories.create_team_membership(team=team, user=user)
        return team

    @staticmethod
    def create_environment(project, **kwargs):
        name = kwargs.get("name", petname.Generate(3, " ", letters=10)[:64])

        organization = kwargs.get("organization")
        organization_id = organization.id if organization else project.organization_id

        env = Environment.objects.create(
            organization_id=organization_id, project_id=project.id, name=name
        )
        env.add_project(project, is_hidden=kwargs.get("is_hidden"))
        return env

    @staticmethod
    def create_project(organization=None, teams=None, fire_project_created=False, **kwargs):
        if not kwargs.get("name"):
            kwargs["name"] = petname.Generate(2, " ", letters=10).title()
        if not kwargs.get("slug"):
            kwargs["slug"] = slugify(str(kwargs["name"]))
        if not organization and teams:
            organization = teams[0].organization

        with transaction.atomic():
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
    def create_project_bookmark(project, user):
        return ProjectBookmark.objects.create(project_id=project.id, user=user)

    @staticmethod
    def create_project_rule(project, action_data=None, condition_data=None):
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
        return Rule.objects.create(
            project=project,
            data={"conditions": condition_data, "actions": action_data, "action_match": "all"},
        )

    @staticmethod
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
    def create_project_key(project):
        return project.key_set.get_or_create()[0]

    @staticmethod
    def create_release(
        project: Project,
        user: Optional[User] = None,
        version: Optional[str] = None,
        date_added: Optional[datetime] = None,
        additional_projects: Optional[Sequence[Project]] = None,
        environments: Optional[Sequence[Environment]] = None,
        date_released: Optional[datetime] = None,
        adopted: Optional[datetime] = None,
        unadopted: Optional[datetime] = None,
    ):
        if version is None:
            version = force_text(hexlify(os.urandom(20)))

        if date_added is None:
            date_added = timezone.now()

        if additional_projects is None:
            additional_projects = []

        release = Release.objects.create(
            version=version,
            organization_id=project.organization_id,
            date_added=date_added,
            date_released=date_released,
        )

        release.add_project(project)
        for additional_project in additional_projects:
            release.add_project(additional_project)

        for environment in environments or []:
            ReleaseEnvironment.objects.create(
                organization=project.organization, release=release, environment=environment
            )
            for project in [project] + additional_projects:
                ReleaseProjectEnvironment.objects.create(
                    project=project,
                    release=release,
                    environment=environment,
                    adopted=adopted,
                    unadopted=unadopted,
                )

        Activity.objects.create(
            type=Activity.RELEASE,
            project=project,
            ident=Activity.get_version_ident(version),
            user=user,
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
    def create_artifact_bundle(org, release, project=None, extra_files=None):
        import zipfile

        bundle = io.BytesIO()
        bundle_dir = get_fixture_path("artifact_bundle")
        with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as zipfile:
            for path, content in (extra_files or {}).items():
                zipfile.writestr(path, content)
            for path, _, files in os.walk(bundle_dir):
                for filename in files:
                    fullpath = os.path.join(path, filename)
                    relpath = os.path.relpath(fullpath, bundle_dir)
                    if filename == "manifest.json":
                        manifest = _patch_artifact_manifest(
                            fullpath, org, release, project, extra_files
                        )
                        zipfile.writestr(relpath, manifest)
                    else:
                        zipfile.write(fullpath, relpath)

        return bundle.getvalue()

    @classmethod
    def create_release_archive(cls, org, release: str, project=None, dist=None):
        bundle = cls.create_artifact_bundle(org, release, project)
        file_ = File.objects.create(name="release-artifacts.zip")
        file_.putfile(ContentFile(bundle))
        release = Release.objects.get(organization__slug=org, version=release)
        return update_artifact_index(release, dist, file_)

    @staticmethod
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
            **kwargs,
        )

    @staticmethod
    def create_repo(project, name=None, provider=None, integration_id=None, url=None):
        repo = Repository.objects.create(
            organization_id=project.organization_id,
            name=name
            or "{}-{}".format(petname.Generate(2, "", letters=10), random.randint(1000, 9999)),
            provider=provider,
            integration_id=integration_id,
            url=url,
        )
        return repo

    @staticmethod
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
    def create_commit_author(organization_id=None, project=None, user=None):
        return CommitAuthor.objects.get_or_create(
            organization_id=organization_id or project.organization_id,
            email=user.email if user else f"{make_word()}@example.com",
            defaults={"name": user.name if user else make_word()},
        )[0]

    @staticmethod
    def create_commit_file_change(commit, filename):
        return CommitFileChange.objects.get_or_create(
            organization_id=commit.organization_id, commit=commit, filename=filename, type="M"
        )

    @staticmethod
    def create_user(email=None, **kwargs):
        if email is None:
            email = uuid4().hex + "@example.com"

        kwargs.setdefault("username", email)
        kwargs.setdefault("is_staff", True)
        kwargs.setdefault("is_active", True)
        kwargs.setdefault("is_superuser", False)

        user = User(email=email, **kwargs)
        if kwargs.get("password") is None:
            user.set_password("admin")
        user.save()

        # UserEmail is created by a signal
        assert UserEmail.objects.filter(user=user, email=email).update(is_verified=True)

        return user

    @staticmethod
    def create_useremail(user, email, **kwargs):
        if not email:
            email = uuid4().hex + "@example.com"

        kwargs.setdefault("is_verified", True)

        useremail = UserEmail(user=user, email=email, **kwargs)
        useremail.save()

        return useremail

    @staticmethod
    def store_event(data, project_id, assert_no_errors=True, sent_at=None):
        # Like `create_event`, but closer to how events are actually
        # ingested. Prefer to use this method over `create_event`
        manager = EventManager(data, sent_at=sent_at)
        manager.normalize()
        if assert_no_errors:
            errors = manager.get_data().get("errors")
            assert not errors, errors

        event = manager.save(project_id)
        if event.group:
            event.group.save()
        return event

    @staticmethod
    def create_group(project, checksum=None, **kwargs):
        if checksum:
            warnings.warn("Checksum passed to create_group", DeprecationWarning)
        kwargs.setdefault("message", "Hello world")
        kwargs.setdefault("data", {})
        if "type" not in kwargs["data"]:
            kwargs["data"].update({"type": "default", "metadata": {"title": kwargs["message"]}})
        if "short_id" not in kwargs:
            kwargs["short_id"] = project.next_short_id()
        return Group.objects.create(project=project, **kwargs)

    @staticmethod
    def create_file(**kwargs):
        return File.objects.create(**kwargs)

    @staticmethod
    def create_file_from_path(path, name=None, **kwargs):
        if name is None:
            name = os.path.basename(path)

        file = Factories.create_file(name=name, **kwargs)
        with open(path) as f:
            file.putfile(f)
        return file

    @staticmethod
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
    def create_dif_from_path(path, object_name=None, **kwargs):
        if object_name is None:
            object_name = os.path.basename(path)

        headers = {"Content-Type": "application/x-mach-binary"}
        file = Factories.create_file_from_path(path, name=object_name, headers=headers)
        return Factories.create_dif_file(file=file, object_name=object_name, **kwargs)

    @staticmethod
    def add_user_permission(user, permission):
        UserPermission.objects.create(user=user, permission=permission)

    @staticmethod
    def create_sentry_app(**kwargs):
        app = sentry_apps.Creator.run(is_internal=False, **Factories._sentry_app_kwargs(**kwargs))

        if kwargs.get("published"):
            app.update(status=SentryAppStatus.PUBLISHED)

        return app

    @staticmethod
    def create_internal_integration(**kwargs):
        return sentry_apps.InternalCreator.run(
            is_internal=True, **Factories._sentry_app_kwargs(**kwargs)
        )

    @staticmethod
    def create_internal_integration_token(install, **kwargs):
        return sentry_app_installation_tokens.Creator.run(sentry_app_installation=install, **kwargs)

    @staticmethod
    def _sentry_app_kwargs(**kwargs):
        _kwargs = {
            "user": kwargs.get("user", Factories.create_user()),
            "name": kwargs.get("name", petname.Generate(2, " ", letters=10).title()),
            "organization": kwargs.get("organization", Factories.create_organization()),
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
    def create_sentry_app_installation(organization=None, slug=None, user=None, status=None):
        if not organization:
            organization = Factories.create_organization()

        Factories.create_project(organization=organization)

        install = sentry_app_installations.Creator.run(
            slug=(slug or Factories.create_sentry_app(organization=organization).slug),
            organization=organization,
            user=(user or Factories.create_user()),
        )
        install.status = SentryAppInstallationStatus.INSTALLED if status is None else status
        install.save()
        return install

    @staticmethod
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
    def create_service_hook(actor=None, org=None, project=None, events=None, url=None, **kwargs):
        if not actor:
            actor = Factories.create_user()
        if not org:
            org = Factories.create_organization(owner=actor)
        if not project:
            project = Factories.create_project(organization=org)
        if events is None:
            events = ("event.created",)
        if not url:
            url = "https://example.com/sentry/webhook"

        _kwargs = {
            "actor": actor,
            "projects": [project],
            "organization": org,
            "events": events,
            "url": url,
        }

        _kwargs.update(kwargs)

        return service_hooks.Creator.run(**_kwargs)

    @staticmethod
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
            "name": kwargs.get("name", petname.Generate(2, " ", letters=10).title()),
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
    def create_doc_integration(features=None, has_avatar: bool = False, **kwargs) -> DocIntegration:
        doc = DocIntegration.objects.create(**Factories._doc_integration_kwargs(**kwargs))
        if features:
            Factories.create_doc_integration_features(features=features, doc_integration=doc)
        if has_avatar:
            Factories.create_doc_integration_avatar(doc_integration=doc)
        return doc

    @staticmethod
    def create_doc_integration_features(
        features=None, doc_integration=None
    ) -> List[IntegrationFeature]:
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
    def create_doc_integration_avatar(doc_integration=None, **kwargs) -> DocIntegrationAvatar:
        if not doc_integration:
            doc_integration = Factories.create_doc_integration()
        photo = File.objects.create(name="test.png", type="avatar.file")
        photo.putfile(io.BytesIO(b"imaginethiswasphotobytes"))
        return DocIntegrationAvatar.objects.create(
            doc_integration=doc_integration, avatar_type=0, file_id=photo.id
        )

    @staticmethod
    def create_userreport(group, project=None, event_id=None, **kwargs):
        return UserReport.objects.create(
            group_id=group.id,
            event_id=event_id or "a" * 32,
            project_id=project.id if project is not None else group.project.id,
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
    def create_integration_external_issue(group=None, integration=None, key=None):
        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=integration.id, key=key
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
        seen_by=None,
        alert_rule=None,
    ):
        if not title:
            title = petname.Generate(2, " ", letters=10).title()
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
        )
        for project in projects:
            IncidentProject.objects.create(incident=incident, project=project)
        if seen_by:
            for user in seen_by:
                IncidentSeen.objects.create(incident=incident, user=user, last_seen=timezone.now())
        return incident

    @staticmethod
    def create_incident_activity(incident, type, comment=None, user=None):
        return IncidentActivity.objects.create(
            incident=incident, type=type, comment=comment, user=user
        )

    @staticmethod
    def create_alert_rule(
        organization,
        projects,
        name=None,
        owner=None,
        query="level:error",
        aggregate="count()",
        time_window=10,
        threshold_period=1,
        include_all_projects=False,
        environment=None,
        excluded_projects=None,
        date_added=None,
        dataset=QueryDatasets.EVENTS,
        threshold_type=AlertRuleThresholdType.ABOVE,
        resolve_threshold=None,
        user=None,
        event_types=None,
        comparison_delta=None,
    ):
        if not name:
            name = petname.Generate(2, " ", letters=10).title()

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
            dataset=dataset,
            environment=environment,
            include_all_projects=include_all_projects,
            excluded_projects=excluded_projects,
            user=user,
            event_types=event_types,
            comparison_delta=comparison_delta,
        )

        if date_added is not None:
            alert_rule.update(date_added=date_added)

        return alert_rule

    @staticmethod
    def create_alert_rule_trigger(alert_rule, label=None, alert_threshold=100):
        if not label:
            label = petname.Generate(2, " ", letters=10).title()

        return create_alert_rule_trigger(alert_rule, label, alert_threshold)

    @staticmethod
    def create_incident_trigger(incident, alert_rule_trigger, status=None):
        if status is None:
            status = TriggerStatus.ACTIVE.value

        return IncidentTrigger.objects.create(
            alert_rule_trigger=alert_rule_trigger, incident=incident, status=status
        )

    @staticmethod
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
            integration,
            sentry_app,
            sentry_app_config=sentry_app_config,
        )

    @staticmethod
    def create_external_user(user: User, **kwargs: Any) -> ExternalActor:
        kwargs.setdefault("provider", ExternalProviders.GITHUB.value)
        kwargs.setdefault("external_name", "")

        return ExternalActor.objects.create(actor=user.actor, **kwargs)

    @staticmethod
    def create_external_team(team: Team, **kwargs: Any) -> ExternalActor:
        kwargs.setdefault("provider", ExternalProviders.GITHUB.value)
        kwargs.setdefault("external_name", "@getsentry/ecosystem")

        return ExternalActor.objects.create(actor=team.actor, **kwargs)

    @staticmethod
    def create_codeowners(project, code_mapping, **kwargs):
        kwargs.setdefault("raw", "")

        return ProjectCodeOwners.objects.create(
            project=project, repository_project_path_config=code_mapping, **kwargs
        )

    @staticmethod
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
    def create_identity_provider(integration: Integration, **kwargs: Any) -> IdentityProvider:
        return IdentityProvider.objects.create(
            type=integration.provider,
            external_id=integration.external_id,
            config={},
        )

    @staticmethod
    def create_identity(
        user: User, identity_provider: IdentityProvider, external_id: str, **kwargs: Any
    ) -> Identity:
        return Identity.objects.create(
            external_id=external_id,
            idp=identity_provider,
            user=user,
            status=IdentityStatus.VALID,
            scopes=[],
        )

    @staticmethod
    def create_group_history(
        group: Group,
        status: int,
        release: Optional[Release] = None,
        actor: Actor = None,
        prev_history: GroupHistory = None,
        date_added: datetime = None,
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
            actor=actor,
            status=status,
            prev_history=prev_history,
            prev_history_date=prev_history_date,
            **kwargs,
        )
