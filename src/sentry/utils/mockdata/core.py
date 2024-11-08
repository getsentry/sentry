from __future__ import annotations

import itertools
import os
import random
import time
import uuid
from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from hashlib import sha1
from random import randint
from typing import Any
from uuid import uuid4

import click
from django.conf import settings
from django.db import IntegrityError, router, transaction
from django.db.models import F
from django.utils import timezone as django_timezone

from sentry import buffer, roles, tsdb
from sentry.constants import ObjectStatus
from sentry.exceptions import HashDiscarded
from sentry.feedback.usecases.create_feedback import FeedbackCreationSource, create_feedback_issue
from sentry.incidents.logic import create_alert_rule, create_alert_rule_trigger, create_incident
from sentry.incidents.models.alert_rule import AlertRuleThresholdType
from sentry.incidents.models.incident import IncidentType
from sentry.ingest.consumer.processors import (
    process_attachment_chunk,
    process_individual_attachment,
)
from sentry.models.activity import Activity
from sentry.models.broadcast import Broadcast
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.deploy import Deploy
from sentry.models.environment import Environment
from sentry.models.eventattachment import EventAttachment
from sentry.models.files.file import File
from sentry.models.group import Group
from sentry.models.grouprelease import GroupRelease
from sentry.models.grouptombstone import TOMBSTONE_FIELDS_FROM_GROUP, GroupTombstone
from sentry.models.organization import Organization
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releasefile import ReleaseFile
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.repository import Repository
from sentry.models.team import Team
from sentry.models.userreport import UserReport
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
    MonitorType,
)
from sentry.services.organization import organization_provisioning_service
from sentry.signals import mocks_loaded
from sentry.similarity import features
from sentry.tsdb.base import TSDBModel
from sentry.types.activity import ActivityType
from sentry.users.models.user import User
from sentry.utils import loremipsum
from sentry.utils.hashlib import md5_text
from sentry.utils.samples import create_sample_event as _create_sample_event
from sentry.utils.samples import create_trace, generate_user, random_normal

PLATFORMS = itertools.cycle(["ruby", "php", "python", "java", "javascript"])

LEVELS = itertools.cycle(["error", "error", "error", "fatal", "warning"])

ENVIRONMENTS = itertools.cycle(["production", "production", "staging", "alpha", "beta", ""])

MONITOR_NAMES = itertools.cycle(settings.CELERYBEAT_SCHEDULE.keys())

MONITOR_SCHEDULES = itertools.cycle(["* * * * *", "0 * * * *", "0 0 * * *"])

LONG_MESSAGE = """Code: 0.
DB::Exception: String is too long for DateTime: 2018-10-26T19:14:18+00:00. Stack trace:

0. clickhouse-server(StackTrace::StackTrace()+0x16) [0x99e9626]
1. clickhouse-server(DB::Exception::Exception(std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > const&, int)+0x22) [0x3087172]
2. clickhouse-server(DB::FunctionComparison<DB::EqualsOp, DB::NameEquals>::executeDateOrDateTimeOrEnumOrUUIDWithConstString(DB::Block&, unsigned long, DB::IColumn const*, DB::IColumn const*, std::shared_ptr<DB::IDataType const> const&, std::shared_ptr<DB::IDataType const> const&, bool, unsigned long)+0x13c8) [0x3b233d8]
3. clickhouse-server(DB::FunctionComparison<DB::EqualsOp, DB::NameEquals>::executeImpl(DB::Block&, std::vector<unsigned long, std::allocator<unsigned long> > const&, unsigned long, unsigned long)+0x576) [0x3bafc86]
4. clickhouse-server(DB::PreparedFunctionImpl::defaultImplementationForNulls(DB::Block&, std::vector<unsigned long, std::allocator<unsigned long> > const&, unsigned long, unsigned long)+0x174) [0x7953cd4]
5. clickhouse-server(DB::PreparedFunctionImpl::executeWithoutLowCardinalityColumns(DB::Block&, std::vector<unsigned long, std::allocator<unsigned long> > const&, unsigned long, unsigned long)+0x54) [0x7953b04]
6. clickhouse-server(DB::PreparedFunctionImpl::execute(DB::Block&, std::vector<unsigned long, std::allocator<unsigned long> > const&, unsigned long, unsigned long)+0x3e2) [0x7954222]
7. clickhouse-server(DB::ExpressionAction::execute(DB::Block&, std::unordered_map<std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> >, unsigned long, std::hash<std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > >, std::equal_to<std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > >, std::allocator<std::pair<std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > const, unsigned long> > >&) const+0x69b) [0x7b021fb]
8. clickhouse-server(DB::ExpressionActions::execute(DB::Block&) const+0xe6) [0x7b03676]
9. clickhouse-server(DB::FilterBlockInputStream::FilterBlockInputStream(std::shared_ptr<DB::IBlockInputStream> const&, std::shared_ptr<DB::ExpressionActions> const&, std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > const&, bool)+0x711) [0x79b7e31]
10. clickhouse-server() [0x75e9443]
11. clickhouse-server(DB::InterpreterSelectQuery::executeImpl(DB::InterpreterSelectQuery::Pipeline&, std::shared_ptr<DB::IBlockInputStream> const&, bool)+0x118f) [0x75f212f]
12. clickhouse-server(DB::InterpreterSelectQuery::InterpreterSelectQuery(std::shared_ptr<DB::IAST> const&, DB::Context const&, std::shared_ptr<DB::IBlockInputStream> const&, std::shared_ptr<DB::IStorage> const&, std::vector<std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> >, std::allocator<std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > > > const&, DB::QueryProcessingStage::Enum, unsigned long, bool)+0x5e6) [0x75f2d46]
13. clickhouse-server(DB::InterpreterSelectQuery::InterpreterSelectQuery(std::shared_ptr<DB::IAST> const&, DB::Context const&, std::vector<std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> >, std::allocator<std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > > > const&, DB::QueryProcessingStage::Enum, unsigned long, bool)+0x56) [0x75f3aa6]
14. clickhouse-server(DB::InterpreterSelectWithUnionQuery::InterpreterSelectWithUnionQuery(std::shared_ptr<DB::IAST> const&, DB::Context const&, std::vector<std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> >, std::allocator<std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > > > const&, DB::QueryProcessingStage::Enum, unsigned long, bool)+0x7e7) [0x75ffab7]
15. clickhouse-server(DB::InterpreterFactory::get(std::shared_ptr<DB::IAST>&, DB::Context&, DB::QueryProcessingStage::Enum)+0x3a8) [0x75dc138]
16. clickhouse-server() [0x768fad9]
17. clickhouse-server(DB::executeQuery(std::__cxx11::basic..."""


def make_sentence(words=None):
    if words is None:
        words = int(random.weibullvariate(8, 3))
    return " ".join(random.choice(loremipsum.words) for _ in range(words))


def create_sample_event(*args, **kwargs):
    try:
        event = _create_sample_event(*args, **kwargs)
    except HashDiscarded as e:
        click.echo(f"> Skipping Event: {e}")
    else:
        if event is not None:
            features.record([event])
            return event


def generate_commit_data(user):
    commits = []
    for i in range(random.randint(1, 20)):
        if i == 1:
            filename = "raven/base.py"
        else:
            filename = random.choice(loremipsum.words) + ".js"
        if random.randint(0, 5) == 1:
            author = (user.name, user.email)
        else:
            author = (
                f"{random.choice(loremipsum.words)} {random.choice(loremipsum.words)}",
                f"{random.choice(loremipsum.words)}@example.com",
            )

        commits.append(
            {
                "key": sha1(uuid4().bytes).hexdigest(),
                "message": f"feat: Do something to {filename}\n{make_sentence()}",
                "author": author,
                "files": [(filename, "M")],
            }
        )
    return commits


def generate_tombstones(project, user):
    # attempt to create a high enough previous_group_id
    # that it won't conflict with any group ids
    prev_group_id = 100000
    try:
        prev_group_id = (
            max(
                GroupTombstone.objects.order_by("-previous_group_id")[0].previous_group_id,
                prev_group_id,
            )
            + 1
        )
    except IndexError:
        pass

    for group in Group.objects.filter(project=project)[:5]:
        GroupTombstone.objects.create(
            previous_group_id=prev_group_id,
            actor_id=user.id,
            **{name: getattr(group, name) for name in TOMBSTONE_FIELDS_FROM_GROUP},
        )
        prev_group_id += 1


def create_system_time_series():
    now = datetime.now(timezone.utc)

    for _ in range(60):
        count = randint(1, 10)
        tsdb.backend.incr_multi(
            (
                (TSDBModel.internal, "client-api.all-versions.responses.2xx"),
                (TSDBModel.internal, "client-api.all-versions.requests"),
            ),
            now,
            int(count * 0.9),
        )
        tsdb.backend.incr_multi(
            ((TSDBModel.internal, "client-api.all-versions.responses.4xx"),),
            now,
            int(count * 0.05),
        )
        tsdb.backend.incr_multi(
            ((TSDBModel.internal, "client-api.all-versions.responses.5xx"),),
            now,
            int(count * 0.1),
        )
        now = now - timedelta(seconds=1)

    for _ in range(24 * 30):
        count = randint(100, 1000)
        tsdb.backend.incr_multi(
            (
                (TSDBModel.internal, "client-api.all-versions.responses.2xx"),
                (TSDBModel.internal, "client-api.all-versions.requests"),
            ),
            now,
            int(count * 4.9),
        )
        tsdb.backend.incr_multi(
            ((TSDBModel.internal, "client-api.all-versions.responses.4xx"),),
            now,
            int(count * 0.05),
        )
        tsdb.backend.incr_multi(
            ((TSDBModel.internal, "client-api.all-versions.responses.5xx"),),
            now,
            int(count * 0.1),
        )
        now = now - timedelta(hours=1)


def create_sample_time_series(event, release=None):
    if event is None:
        return

    group = event.group
    project = group.project
    key = project.key_set.all()[0]

    now = datetime.now(timezone.utc)

    environment = Environment.get_or_create(
        project=project, name=Environment.get_name_or_default(event.get_tag("environment"))
    )

    if release:
        ReleaseEnvironment.get_or_create(
            project=project, release=release, environment=environment, datetime=now
        )

        grouprelease = GroupRelease.get_or_create(
            group=group, release=release, environment=environment, datetime=now
        )

    for _ in range(60):
        count = randint(1, 10)
        tsdb.backend.incr_multi(
            ((TSDBModel.project, project.id), (TSDBModel.group, group.id)),
            now,
            count,
            environment_id=environment.id,
        )
        tsdb.backend.incr_multi(
            (
                (TSDBModel.organization_total_received, project.organization_id),
                (TSDBModel.project_total_received, project.id),
                (TSDBModel.key_total_received, key.id),
            ),
            now,
            int(count * 1.1),
        )
        tsdb.backend.incr(
            TSDBModel.project_total_forwarded,
            project.id,
            now,
            int(count * 1.1),
        )
        tsdb.backend.incr_multi(
            (
                (TSDBModel.organization_total_rejected, project.organization_id),
                (TSDBModel.project_total_rejected, project.id),
                (TSDBModel.key_total_rejected, key.id),
            ),
            now,
            int(count * 0.1),
        )

        frequencies = [
            (TSDBModel.frequent_issues_by_project, {project.id: {group.id: count}}),
            (TSDBModel.frequent_environments_by_group, {group.id: {environment.id: count}}),
        ]
        if release:
            frequencies.append(
                (TSDBModel.frequent_releases_by_group, {group.id: {grouprelease.id: count}})
            )

        tsdb.backend.record_frequency_multi(frequencies, now)

        now = now - timedelta(seconds=1)

    for _ in range(24 * 30):
        count = randint(100, 1000)
        tsdb.backend.incr_multi(
            ((TSDBModel.project, group.project.id), (TSDBModel.group, group.id)),
            now,
            count,
            environment_id=environment.id,
        )
        tsdb.backend.incr_multi(
            (
                (TSDBModel.organization_total_received, project.organization_id),
                (TSDBModel.project_total_received, project.id),
                (TSDBModel.key_total_received, key.id),
            ),
            now,
            int(count * 1.1),
        )
        tsdb.backend.incr_multi(
            (
                (TSDBModel.organization_total_rejected, project.organization_id),
                (TSDBModel.project_total_rejected, project.id),
                (TSDBModel.key_total_rejected, key.id),
            ),
            now,
            int(count * 0.1),
        )

        frequencies = [
            (TSDBModel.frequent_issues_by_project, {project.id: {group.id: count}}),
            (TSDBModel.frequent_environments_by_group, {group.id: {environment.id: count}}),
        ]
        if release:
            frequencies.append(
                (TSDBModel.frequent_releases_by_group, {group.id: {grouprelease.id: count}})
            )

        tsdb.backend.record_frequency_multi(frequencies, now)

        now = now - timedelta(hours=1)


def get_superuser() -> User:
    try:
        user = User.objects.filter(is_superuser=True)[0]
        return user
    except IndexError:
        raise Exception("No superuser exists (run `make bootstrap`)")


def create_user() -> User:
    user, _ = User.objects.get_or_create(
        username="dummy@example.com", defaults={"email": "dummy@example.com"}
    )
    user.set_password("dummy")
    user.save()

    return user


def create_broadcast() -> None:
    Broadcast.objects.create(
        title="Learn about Source Maps",
        message="Source maps are JSON files that contain information on how to map your transpiled source code back to their original source.",
        link="https://docs.sentry.io/platforms/javascript/#source-maps",
    )


def get_organization() -> Organization:
    if settings.SENTRY_SINGLE_ORGANIZATION:
        org = Organization.get_default()
        click.echo(f"Mocking org {org.name}")
    else:
        click.echo("Mocking org {}".format("Default"))
        with transaction.atomic(router.db_for_write(Organization)):
            org, _ = Organization.objects.get_or_create(slug="default")

        # We need to provision an organization slug in control silo, so we do
        # this by "changing" the slug, then re-replicating the org data.
        organization_provisioning_service.change_organization_slug(
            organization_id=org.id, slug=org.slug
        )
        org.handle_async_replication(org.id)

    return org


def create_owner(organization: Organization, user: User, role: str | None = None) -> None:
    create_member(organization, user, roles.get_top_dog().id)


def create_member(
    organization: Organization, user: User, role: str | None = None
) -> OrganizationMember:
    member, _ = OrganizationMember.objects.get_or_create(
        user_id=user.id, organization=organization, defaults={"role": role}
    )

    return member


def create_access_request(member: OrganizationMember, team: Team) -> None:
    OrganizationAccessRequest.objects.create_or_update(member=member, team=team)


def generate_projects(organization: Organization) -> Mapping[str, Any]:
    mocks = (
        ("Massive Dynamic", ("Ludic Science",)),
        ("Captain Planet", ("Earth", "Fire", "Wind", "Water", "Heart")),
    )
    project_map = {}

    # Quickly fetch/create the teams and projects
    for team_name, project_names in mocks:
        click.echo(f"> Mocking team {team_name}")
        team, _ = Team.objects.get_or_create(
            name=team_name, defaults={"organization": organization}
        )

        for project_name in project_names:
            click.echo(f"  > Mocking project {project_name}")
            project, _ = Project.objects.get_or_create(
                name=project_name,
                defaults={
                    "organization": organization,
                    "flags": Project.flags.has_releases,
                    "first_event": django_timezone.now(),
                },
            )
            project_map[project_name] = project
            project.add_team(team)

    return project_map


def create_environment(project: Project) -> Environment:
    return Environment.get_or_create(project=project, name=next(ENVIRONMENTS))


def create_monitor(project: Project, environment: Environment) -> None:
    monitor, _ = Monitor.objects.get_or_create(
        name=next(MONITOR_NAMES),
        project_id=project.id,
        organization_id=project.organization_id,
        type=MonitorType.CRON_JOB,
        defaults={
            "status": ObjectStatus.DISABLED,
            "config": {"schedule": next(MONITOR_SCHEDULES)},
        },
    )

    monitor_env, _ = MonitorEnvironment.objects.get_or_create(
        monitor=monitor,
        environment_id=environment.id,
        defaults={
            "status": MonitorStatus.DISABLED,
            "next_checkin": django_timezone.now() + timedelta(minutes=60),
            "last_checkin": django_timezone.now(),
        },
    )

    MonitorCheckIn.objects.create(
        project_id=monitor.project_id,
        monitor=monitor,
        monitor_environment=monitor_env,
        status=CheckInStatus.OK if monitor_env.status == MonitorStatus.OK else CheckInStatus.ERROR,
    )


def create_release(project: Project) -> Release:
    with transaction.atomic(using=router.db_for_write(Release)):
        release, _ = Release.objects.get_or_create(
            version=sha1(uuid4().bytes).hexdigest(),
            organization_id=project.organization_id,
        )
        release.add_project(project)

    return release


def create_repository(organization: Organization) -> Repository:
    try:
        with transaction.atomic(using=router.db_for_write(Repository)):
            repo, _ = Repository.objects.get_or_create(
                organization_id=organization.id,
                provider="integrations:github",
                external_id="example/example",
                defaults={
                    "name": "Example Repo",
                    "url": "https://github.com/example/example",
                },
            )
        return repo
    except IntegrityError:
        # for users with legacy github plugin
        # upgrade to the new integration
        repo = Repository.objects.get(
            organization_id=organization.id,
            provider="github",
            external_id="example/example",
            name="Example Repo",
        )
        repo.provider = "integrations:github"
        repo.save()

        return repo


def populate_release(
    project: Project,
    environment: Environment,
    repository: Repository,
    release: Release,
    user: User,
    commits: list[Mapping[str, Any]],
) -> None:
    authors = set()

    commit = None
    for commit_index, raw_commit in enumerate(commits):
        author = CommitAuthor.objects.get_or_create(
            organization_id=project.organization_id,
            email=raw_commit["author"][1],
            defaults={"name": raw_commit["author"][0]},
        )[0]
        commit = Commit.objects.get_or_create(
            organization_id=project.organization_id,
            repository_id=repository.id,
            key=raw_commit["key"],
            defaults={"author": author, "message": raw_commit["message"]},
        )[0]
        authors.add(author)

        for file in raw_commit["files"]:
            ReleaseFile.objects.get_or_create(
                organization_id=project.organization_id,
                release_id=release.id,
                name=file[0],
                file=File.objects.get_or_create(
                    name=file[0], type="release.file", checksum="abcde" * 8, size=13043
                )[0],
                defaults={"organization_id": project.organization_id},
            )

            CommitFileChange.objects.get_or_create(
                organization_id=project.organization_id,
                commit=commit,
                filename=file[0],
                type=file[1],
            )

        ReleaseCommit.objects.get_or_create(
            organization_id=project.organization_id,
            release=release,
            commit=commit,
            order=commit_index,
        )

    # create an unreleased commit
    Commit.objects.get_or_create(
        organization_id=project.organization_id,
        repository_id=repository.id,
        key=sha1(uuid4().bytes).hexdigest(),
        defaults={
            "author": CommitAuthor.objects.get_or_create(
                organization_id=project.organization_id,
                email=user.email,
                defaults={"name": user.name},
            )[0],
            "message": "feat: Do something to {}\n{}".format(
                random.choice(loremipsum.words) + ".js", make_sentence()
            ),
        },
    )[0]

    Activity.objects.create(
        type=ActivityType.RELEASE.value,
        project=project,
        ident=release.version,
        user_id=user.id,
        data={"version": release.version},
    )

    deploy = Deploy.objects.create(
        organization_id=project.organization_id,
        release=release,
        environment_id=environment.id,
    )

    if commit:
        release.update(
            commit_count=len(commits),
            last_commit_id=commit.id,
            total_deploys=Deploy.objects.filter(release=release).count(),
            last_deploy_id=deploy.id,
            authors=[str(a.id) for a in authors],
        )

    ReleaseProjectEnvironment.objects.create_or_update(
        project=project,
        environment=environment,
        release=release,
        defaults={"last_deploy_id": deploy.id},
    )

    Activity.objects.create(
        type=ActivityType.DEPLOY.value,
        project=project,
        ident=release.version,
        data={
            "version": release.version,
            "deploy_id": deploy.id,
            "environment": environment.name,
        },
        datetime=deploy.date_finished,
    )


def generate_events(
    project: Project,
    release: Release,
    repository: Repository,
    user: User,
    num_events: int,
    extra_events: bool = False,
) -> list[Any]:
    generated_events = []

    # Allow for 0 events, if you only want transactions
    event1 = event2 = event3 = event4 = event5 = None

    # Add a bunch of additional dummy events to support pagination
    if extra_events:
        for i in range(45):
            platform = next(PLATFORMS)

            create_sample_event(
                project=project,
                platform=platform,
                release=release.version,
                level=next(LEVELS),
                environment=next(ENVIRONMENTS),
                logentry={"formatted": "This is a mostly useless example %s exception" % platform},
                checksum=md5_text(f"{platform}{i}").hexdigest(),
                user=generate_user(),
            )

    for _ in range(num_events):
        event1 = create_sample_event(
            project=project,
            platform="python",
            release=release.version,
            environment=next(ENVIRONMENTS),
            user=generate_user(),
        )
        generated_events.append(event1)

        EventAttachment.objects.create(
            project_id=project.id,
            event_id=event1.event_id,
            name="example-logfile.txt",
            file_id=File.objects.get_or_create(
                name="example-logfile.txt",
                type="text/plain",
                checksum="abcde" * 8,
                size=13043,
            )[0].id,
        )

        event2 = create_sample_event(
            project=project,
            platform="javascript",
            release=release.version,
            environment=next(ENVIRONMENTS),
            sdk={"name": "raven-js", "version": "2.1.0"},
            user=generate_user(),
        )
        generated_events.append(event2)

        event3 = create_sample_event(project, "java")
        generated_events.append(event3)

        event4 = create_sample_event(
            project=project,
            platform="ruby",
            release=release.version,
            environment=next(ENVIRONMENTS),
            user=generate_user(),
        )
        generated_events.append(event4)

        event5 = create_sample_event(
            project=project,
            platform="cocoa",
            release=release.version,
            environment=next(ENVIRONMENTS),
            user=generate_user(),
        )
        generated_events.append(event5)

        create_sample_event(
            project=project,
            platform="php",
            release=release.version,
            environment=next(ENVIRONMENTS),
            logentry={"formatted": LONG_MESSAGE},
            user=generate_user(),
        )

        create_sample_event(
            project=project,
            platform="cocoa",
            sample_name="react-native",
            release=release.version,
            environment=next(ENVIRONMENTS),
            user=generate_user(),
        )

        create_sample_event(
            project=project,
            platform="pii",
            release=release.version,
            environment=next(ENVIRONMENTS),
            user=generate_user(),
        )
    if event5:
        Commit.objects.get_or_create(
            organization_id=project.organization_id,
            repository_id=repository.id,
            key=sha1(uuid4().bytes).hexdigest(),
            defaults={
                "author": CommitAuthor.objects.get_or_create(
                    organization_id=project.organization_id,
                    email=user.email,
                    defaults={"name": user.name},
                )[0],
                "message": f"Ooops!\nFixes {event5.group.qualified_short_id}",
            },
        )[0]

    create_sample_event(project=project, environment=next(ENVIRONMENTS), platform="csp")

    if event3:
        UserReport.objects.create(
            project_id=project.id,
            event_id=event3.event_id,
            group_id=event3.group.id,
            name="Jane Bloggs",
            email="jane@example.com",
            comments=make_sentence(),
        )

    return generated_events


def create_metric_alert_rule(organization: Organization, project: Project) -> None:
    # Metric alerts
    alert_rule = create_alert_rule(
        organization,
        [project],
        "My Alert Rule",
        "level:error",
        "count()",
        10,
        AlertRuleThresholdType.ABOVE,
        1,
    )
    create_alert_rule_trigger(alert_rule, "critical", 10)
    create_incident(
        organization,
        incident_type=IncidentType.DETECTED,
        title="My Incident",
        date_started=datetime.now(timezone.utc),
        alert_rule=alert_rule,
        projects=[project],
    )


def create_mock_transactions(
    project_map, load_trends=False, load_performance_issues=False, slow=False
):
    backend_project = project_map["Earth"]
    frontend_project = project_map["Fire"]
    service_projects = [
        project_map["Wind"],
        project_map["Water"],
        project_map["Heart"],
    ]
    for project in project_map.values():
        if not project.flags.has_transactions:
            project.update(flags=F("flags").bitor(Project.flags.has_transactions))

    timestamp = django_timezone.now()
    click.echo(f"    > Loading a trace")  # NOQA
    create_trace(
        slow,
        timestamp - timedelta(milliseconds=random_normal(4000, 250, 1000)),
        timestamp,
        generate_user(),
        uuid4().hex,
        None,
        {
            "project": frontend_project,
            "transaction": "/plants/:plantId/",
            "frontend": True,
            "errors": 1,
            "children": [
                {
                    "project": backend_project,
                    "transaction": "/api/plants/",
                    "children": [
                        {
                            "project": service_projects[0],
                            "transaction": "/products/all/",
                            "children": [],
                        },
                        {
                            "project": service_projects[1],
                            "transaction": "/analytics/",
                            "children": [],
                        },
                        {
                            "project": service_projects[2],
                            "transaction": "tasks.create_invoice",
                            "children": [
                                {
                                    "project": service_projects[2],
                                    "transaction": "tasks.process_invoice",
                                    "children": [
                                        {
                                            "project": service_projects[2],
                                            "transaction": "tasks.process_invoice",
                                            "children": [
                                                {
                                                    "project": service_projects[2],
                                                    "transaction": "tasks.process_invoice",
                                                    "children": [
                                                        {
                                                            "project": service_projects[2],
                                                            "transaction": "tasks.process_invoice",
                                                            "children": [],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    )

    if load_trends:
        click.echo(f"    > Loading trends data")  # NOQA
        for day in range(14):
            for hour in range(24):
                timestamp = django_timezone.now() - timedelta(days=day, hours=hour)
                transaction_user = generate_user()
                trace_id = uuid4().hex

                frontend_span_id = uuid4().hex[:16]
                frontend_root_span_id = uuid4().hex[:16]
                frontend_duration = random_normal(2000 - 50 * day, 250, 1000)

                create_sample_event(
                    project=frontend_project,
                    platform="javascript-transaction",
                    transaction="/trends/:frontend/",
                    event_id=uuid4().hex,
                    user=transaction_user,
                    timestamp=timestamp,
                    # start_timestamp decreases based on day so that there's a trend
                    start_timestamp=timestamp - timedelta(milliseconds=frontend_duration),
                    measurements={
                        "fp": {"value": random_normal(1250 - 50 * day, 200, 500)},
                        "fcp": {"value": random_normal(1250 - 50 * day, 200, 500)},
                        "lcp": {"value": random_normal(2800 - 50 * day, 400, 2000)},
                        "fid": {"value": random_normal(5 - 0.125 * day, 2, 1)},
                    },
                    # Root
                    parent_span_id=None,
                    span_id=frontend_root_span_id,
                    trace=trace_id,
                    spans=[
                        {
                            "same_process_as_parent": True,
                            "op": "http",
                            "description": "GET /api/plants/?all_plants=1",
                            "data": {
                                "duration": random_normal(
                                    1 - 0.05 * day, 0.25, 0.01, frontend_duration / 1000
                                ),
                                "offset": 0.02,
                            },
                            "span_id": frontend_span_id,
                            "trace_id": trace_id,
                        }
                    ],
                )
                # try to give clickhouse some breathing room
                if slow:
                    time.sleep(0.05)

                backend_duration = random_normal(1500 + 50 * day, 250, 500)

                create_sample_event(
                    project=backend_project,
                    platform="transaction",
                    transaction="/trends/backend/",
                    event_id=uuid4().hex,
                    user=transaction_user,
                    timestamp=timestamp,
                    start_timestamp=timestamp - timedelta(milliseconds=backend_duration),
                    # match the trace from the javascript transaction
                    trace=trace_id,
                    parent_span_id=frontend_root_span_id,
                    spans=[],
                )

                # try to give clickhouse some breathing room
                if slow:
                    time.sleep(0.05)

    if load_performance_issues:

        def load_n_plus_one_issue():
            trace_id = uuid4().hex
            transaction_user = generate_user()
            frontend_root_span_id = uuid4().hex[:16]

            n_plus_one_db_current_offset = timestamp
            n_plus_one_db_duration = timedelta(milliseconds=100)

            parent_span_id = uuid4().hex[:16]

            source_span = {
                "timestamp": (timestamp + n_plus_one_db_duration).timestamp(),
                "start_timestamp": (timestamp + timedelta(milliseconds=10)).timestamp(),
                "description": "SELECT `books_book`.`id`, `books_book`.`title`, `books_book`.`author_id` FROM `books_book` ORDER BY `books_book`.`id` DESC LIMIT 10",
                "op": "db",
                "parent_span_id": parent_span_id,
                "span_id": uuid4().hex[:16],
                "hash": "858fea692d4d93e8",
            }

            def make_repeating_span(duration):
                nonlocal timestamp
                nonlocal n_plus_one_db_current_offset
                nonlocal n_plus_one_db_duration
                n_plus_one_db_duration += timedelta(milliseconds=duration) + timedelta(
                    milliseconds=1
                )
                n_plus_one_db_current_offset = timestamp + n_plus_one_db_duration
                return {
                    "timestamp": (
                        n_plus_one_db_current_offset + timedelta(milliseconds=duration)
                    ).timestamp(),
                    "start_timestamp": (
                        n_plus_one_db_current_offset + timedelta(milliseconds=1)
                    ).timestamp(),
                    "description": "SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
                    "op": "db",
                    "span_id": uuid4().hex[:16],
                    "parent_span_id": parent_span_id,
                    "hash": "63f1e89e6a073441",
                }

            repeating_spans = [make_repeating_span(200) for _ in range(10)]

            parent_span = {
                "timestamp": (
                    timestamp + n_plus_one_db_duration + timedelta(milliseconds=200)
                ).timestamp(),
                "start_timestamp": timestamp.timestamp(),
                "description": "new",
                "op": "django.view",
                "parent_span_id": uuid4().hex[:16],
                "span_id": parent_span_id,
                "hash": "0f43fb6f6e01ca52",
            }

            create_sample_event(
                project=backend_project,
                platform="transaction",
                transaction="/n_plus_one_db/backend/",
                event_id=uuid4().hex,
                user=transaction_user,
                timestamp=timestamp + n_plus_one_db_duration + timedelta(milliseconds=300),
                start_timestamp=timestamp,
                trace=trace_id,
                parent_span_id=frontend_root_span_id,
                spans=[
                    parent_span,
                    source_span,
                ]
                + repeating_spans,
            )

            time.sleep(1.0)

            create_sample_event(
                project=backend_project,
                platform="transaction",
                transaction="/file-io-main-thread/",
                event_id=uuid4().hex,
                user=transaction_user,
                timestamp=timestamp + timedelta(milliseconds=300),
                start_timestamp=timestamp,
                trace=trace_id,
                parent_span_id=frontend_root_span_id,
                spans=[
                    parent_span,
                    {
                        "timestamp": (timestamp + timedelta(milliseconds=200)).timestamp(),
                        "start_timestamp": timestamp.timestamp(),
                        "description": "1669031858711_file.txt (4.0 kB)",
                        "op": "file.write",
                        "span_id": uuid4().hex[:16],
                        "parent_span_id": parent_span_id,
                        "status": "ok",
                        "data": {
                            "blocked_ui_thread": True,
                            "call_stack": [
                                {
                                    "function": "onClick",
                                    "in_app": True,
                                    "lineno": 2,
                                    "module": "io.sentry.samples.android.MainActivity$$ExternalSyntheticLambda6",
                                    "native": False,
                                },
                                {
                                    "filename": "MainActivity.java",
                                    "function": "lambda$onCreate$5$io-sentry-samples-android-MainActivity",
                                    "in_app": True,
                                    "lineno": 93,
                                    "module": "io.sentry.samples.android.MainActivity",
                                    "native": False,
                                },
                            ],
                            "file.path": "/data/user/0/io.sentry.samples.android/files/1669031858711_file.txt",
                            "file.size": 4010,
                        },
                    },
                ],
            )

        def load_uncompressed_asset_issue():
            time.sleep(1.0)
            transaction_user = generate_user()
            trace_id = uuid4().hex
            parent_span_id = uuid4().hex[:16]

            parent_span = {
                "timestamp": (timestamp + timedelta(milliseconds=300)).timestamp(),
                "start_timestamp": timestamp.timestamp(),
                "description": "new",
                "op": "pageload",
                "parent_span_id": uuid4().hex[:16],
                "span_id": parent_span_id,
                "hash": "0f43fb6f6e01ca52",
            }

            spans = [
                {
                    "timestamp": (timestamp + timedelta(milliseconds=1000)).timestamp(),
                    "start_timestamp": (timestamp + timedelta(milliseconds=300)).timestamp(),
                    "description": "https://s1.sentry-cdn.com/_static/dist/sentry/entrypoints/app.js",
                    "op": "resource.script",
                    "parent_span_id": parent_span_id,
                    "span_id": uuid4().hex[:16],
                    "hash": "858fea692d4d93e9",
                    "data": {
                        "http.response_transfer_size": 1_000_000,
                        "http.response_content_length": 1_000_000,
                        "http.decoded_response_content_length": 1_000_000,
                    },
                },
            ]

            create_sample_event(
                project=backend_project,
                platform="transaction",
                transaction="/uncompressed-asset/",
                event_id=uuid4().hex,
                user=transaction_user,
                timestamp=timestamp + timedelta(milliseconds=300),
                start_timestamp=timestamp,
                trace=trace_id,
                parent_span_id=parent_span_id,
                spans=[parent_span] + spans,
            )

        def load_consecutive_db_issue():
            time.sleep(1.0)
            transaction_user = generate_user()
            trace_id = uuid4().hex
            parent_span_id = uuid4().hex[:16]

            parent_span = {
                "timestamp": (timestamp + timedelta(milliseconds=300)).timestamp(),
                "start_timestamp": timestamp.timestamp(),
                "description": "new",
                "op": "django.view",
                "parent_span_id": uuid4().hex[:16],
                "span_id": parent_span_id,
                "hash": "0f43fb6f6e01ca52",
            }

            spans = [
                {
                    "timestamp": (timestamp + timedelta(milliseconds=1000)).timestamp(),
                    "start_timestamp": (timestamp + timedelta(milliseconds=300)).timestamp(),
                    "description": "SELECT `customer`.`id` FROM `customers` WHERE `customer`.`name` = 'customerName'",
                    "op": "db",
                    "parent_span_id": parent_span_id,
                    "span_id": uuid4().hex[:16],
                    "hash": "858fea692d4d93e9",
                },
                {
                    "timestamp": (timestamp + timedelta(milliseconds=2000)).timestamp(),
                    "start_timestamp": (timestamp + timedelta(milliseconds=1000)).timestamp(),
                    "description": "SELECT COUNT(*) FROM `customers`",
                    "op": "db",
                    "parent_span_id": parent_span_id,
                    "span_id": uuid4().hex[:16],
                    "hash": "858fea692d4d93e7",
                },
                {
                    "timestamp": (timestamp + timedelta(milliseconds=3000)).timestamp(),
                    "start_timestamp": (timestamp + timedelta(milliseconds=2000)).timestamp(),
                    "description": "SELECT COUNT(*) FROM `items`",
                    "op": "db",
                    "parent_span_id": parent_span_id,
                    "span_id": uuid4().hex[:16],
                    "hash": "858fea692d4d93e6",
                },
            ]

            create_sample_event(
                project=backend_project,
                platform="transaction",
                transaction="/consecutive-db/",
                event_id=uuid4().hex,
                user=transaction_user,
                timestamp=timestamp + timedelta(milliseconds=300),
                start_timestamp=timestamp,
                trace=trace_id,
                parent_span_id=parent_span_id,
                spans=[parent_span] + spans,
            )

        def load_render_blocking_asset_issue():
            transaction_user = generate_user()
            trace_id = uuid4().hex
            parent_span_id = uuid4().hex[:16]

            spans = [
                {
                    "timestamp": (timestamp + timedelta(milliseconds=1300)).timestamp(),
                    "start_timestamp": (timestamp + timedelta(milliseconds=300)).timestamp(),
                    "description": "https://example.com/asset.js",
                    "op": "resource.script",
                    "parent_span_id": parent_span_id,
                    "span_id": uuid4().hex[:16],
                    "hash": "858fea692d4d93e8",
                    "data": {"http.response_content_length": 1000001},
                }
            ]

            create_sample_event(
                project=frontend_project,
                platform="transaction",
                transaction="/render-blocking-asset/",
                event_id=uuid4().hex,
                user=transaction_user,
                timestamp=timestamp + timedelta(milliseconds=300),
                start_timestamp=timestamp,
                trace=trace_id,
                parent_span_id=parent_span_id,
                spans=spans,
                measurements={
                    "fcp": {"value": 2500.0},
                },
            )

        def load_m_n_plus_one_issue():
            trace_id = uuid4().hex
            transaction_user = generate_user()

            parent_span_id = uuid4().hex[:16]
            duration = 200

            def make_repeating_span(i):
                nonlocal timestamp
                nonlocal duration
                start_timestamp = timestamp + timedelta(milliseconds=i * (duration + 1))
                end_timestamp = start_timestamp + timedelta(milliseconds=duration)
                op = "http" if i % 2 == 0 else "db"
                description = "GET /" if i % 2 == 0 else "SELECT * FROM authors WHERE id = %s"
                hash = "63f1e89e6a073441" if i % 2 == 0 else "a109ff3ef40f7fb3"
                return {
                    "timestamp": end_timestamp.timestamp(),
                    "start_timestamp": start_timestamp.timestamp(),
                    "description": description,
                    "op": op,
                    "span_id": uuid4().hex[:16],
                    "parent_span_id": parent_span_id,
                    "hash": hash,
                }

            span_count = 10
            repeating_spans = [make_repeating_span(i) for i in range(span_count)]

            parent_span = {
                "timestamp": (
                    timestamp + timedelta(milliseconds=span_count * (duration + 1))
                ).timestamp(),
                "start_timestamp": timestamp.timestamp(),
                "description": "execute",
                "op": "graphql.execute",
                "parent_span_id": uuid4().hex[:16],
                "span_id": parent_span_id,
                "hash": "0f43fb6f6e01ca52",
            }

            create_sample_event(
                project=backend_project,
                platform="transaction",
                transaction="/m_n_plus_one_db/backend/",
                event_id=uuid4().hex,
                user=transaction_user,
                timestamp=timestamp + timedelta(milliseconds=span_count * (duration + 1) + 100),
                start_timestamp=timestamp,
                trace=trace_id,
                spans=[parent_span] + repeating_spans,
            )

        def generate_performance_issues():
            click.echo(f"    > Loading performance issues data")  # NOQA
            click.echo(f"    > Loading n plus one issue")  # NOQA
            load_n_plus_one_issue()
            click.echo(f"    > Loading consecutive db issue")  # NOQA
            load_consecutive_db_issue()
            click.echo(f"    > Loading uncompressed asset issue")  # NOQA
            load_uncompressed_asset_issue()
            click.echo(f"    > Loading render blocking asset issue")  # NOQA
            load_render_blocking_asset_issue()
            click.echo(f"    > Loading MN+1 issue")  # NOQA
            load_m_n_plus_one_issue()

        generate_performance_issues()


def create_mock_attachment(event_id, project):
    attachment_id = str(uuid.uuid4())
    file_dir = os.path.dirname(os.path.abspath(__file__))
    attachment_path = os.path.join(file_dir, "../../static/sentry/images/favicon.png")
    with open(attachment_path, "rb") as f:
        payload = f.read()

    attachment_chunk = {
        "type": "attachment_chunk",
        "payload": payload,
        "event_id": event_id,
        "project_id": project.id,
        "id": attachment_id,
        "chunk_index": 0,
    }
    attachment_event = {
        "type": "attachment",
        "event_id": event_id,
        "project_id": project.id,
        "attachment": {
            "id": attachment_id,
            "name": "screenshot.png",
            "content_type": "application/png",
            "attachment_type": "event.attachment",
            "chunks": 1,
            "size": len(payload),
            "rate_limited": False,
        },
    }

    process_attachment_chunk(attachment_chunk)
    process_individual_attachment(attachment_event, project)


def create_mock_user_feedback(project, has_attachment=True):
    event = {
        "project_id": project.id,
        "request": {
            "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            },
        },
        "event_id": str(uuid.uuid4()).replace("-", ""),
        "timestamp": time.time(),
        "received": "2024-4-27T22:23:29.574000+00:00",
        "environment": next(ENVIRONMENTS),
        "release": "frontend@daf1316f209d961443664cd6eb4231ca154db502",
        "user": {
            "ip_address": "72.164.175.154",
            "email": "josh.ferge@sentry.io",
            "id": 880461,
            "isStaff": False,
            "name": "Josh Ferge",
        },
        "contexts": {
            "feedback": {
                "contact_email": "josh.ferge@sentry.io",
                "name": "Josh Ferge",
                "message": " test test   ",
                "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            },
        },
        "breadcrumbs": [],
        "platform": "javascript",
    }
    create_feedback_issue(event, project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    if has_attachment:
        create_mock_attachment(event["event_id"], project)


def main(
    skip_default_setup=False,
    num_events=1,
    extra_events=False,
    load_trends=False,
    load_performance_issues=False,
    slow=False,
):
    owner = get_superuser()
    user = create_user()
    create_broadcast()

    organization = get_organization()
    create_owner(organization, owner)
    member = create_member(organization, user, role=roles.get_default().id)

    project_map = generate_projects(organization)
    if not skip_default_setup:
        for project in project_map.values():
            environment = create_environment(project)
            create_monitor(project, environment)
            create_access_request(member, project.teams.first())

            generate_tombstones(project, user)
            release = create_release(project)
            repo = create_repository(organization)
            raw_commits = generate_commit_data(user)
            populate_release(
                project=project,
                environment=environment,
                repository=repo,
                release=release,
                user=user,
                commits=raw_commits,
            )
            create_metric_alert_rule(organization, project)
            events = generate_events(
                project=project,
                release=release,
                repository=repo,
                user=user,
                num_events=num_events,
                extra_events=extra_events,
            )
            for event in events:
                create_sample_time_series(event, release=release)

            if hasattr(buffer, "process_pending"):
                click.echo("    > Processing pending buffers")
                buffer.process_pending()

            mocks_loaded.send(project=project, sender=__name__)

    create_mock_user_feedback(project_map["Wind"])
    create_mock_transactions(project_map, load_trends, load_performance_issues, slow)
    create_system_time_series()
