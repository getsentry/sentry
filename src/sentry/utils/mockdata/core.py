from __future__ import annotations

import itertools
import random
import time
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
from sentry.models.user import User
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
        for _ in range(45):
            platform = next(PLATFORMS)

            create_sample_event(
                project=project,
                platform=platform,
                release=release.version,
                level=next(LEVELS),
                environment=next(ENVIRONMENTS),
                message="This is a mostly useless example %s exception" % platform,
                checksum=md5_text(platform + str(_)).hexdigest(),
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
            message=LONG_MESSAGE,
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
        type_=IncidentType.DETECTED,
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
    attachment_id = "e0448399-99f7-461c-ad4f-aee073b268e4"
    attachment_chunk = {
        "type": "attachment_chunk",
        "payload": b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00Z\x00\x00\x009\x08\x06\x00\x00\x00\xb6\xc8<\xf6\x00\x00\x00\x01sRGB\x00\xae\xce\x1c\xe9\x00\x00\r7IDATx^\xed\x9cyp\x1c\xd5\x9d\xc7?\xdd=\xa7F\xf79:G\x96lK\x96d\xb0#\xc9'\x0e\x0e.\xecPd\x9d\x85\x98\xa2\xb2\x8b\x97\r\x14^\\\\[$\x85\xa9\x00{f\xd9\xcdf\xd9\x84P1\x04\x02d\x815\x18\xec\x8018&\x8e\xc1\xc4\xb7Md[\x96uY\xb2u[\x1a\x9d#\xcd\x8c\xa6g\xfa\xd8\xea\xb6q\xb1.\x88p\xd0\xc8\x93\xa0\xf7\xd7\xcc\xf4{\xbf\xee\xf7y\xbf\xfa\xbe\xf7\xfb\xfdZ\x12t]\xd7\xb9\xa4m\xde\xbc\x99[o\xbd\xf5\xd2\x9f\xa7\xbf\x7f\x01\x02\xc24\xe8/@\xef2\x86N\x83\xbe\x0cX_\xa4\xeb4\xe8/B\xef2\xc6~&\xe8G\x1f}\xf42\xccLw\x9d\x88\xc0\xb4GODh\x12\xae\xaf\\\xb9\x92i\xd0\x93\x00r\"\x13\xd3\xa0'\"4I\xd7\xa7AO\x12\xc8\x89\xccL\x83\x9e\x88\xd0$]\x9f\x06=I '2\x13\x93\xa0\x15U\xc5\"I\x13=\xfb\x9f\xd4\xf5\x98\x03}\xf2T=\x08\x02\x15sJ\x11\x04\xe1\x8f\x86\xe9\x0f\x04\xe8\xef\xefgFa\xe1\x1fmc2\x07\xc6\x1c\xe8\xda\xfaF\xdc\xb9y\xb44\xd4\xb1d\xd1\xa2\xcb\x9e\xab\x91\x1f{{\xc7\x0e\xe6\xcc\xafb\xb0\xbf\x9f\xc5WW\\\xb6\x8dh\x0c\x88)\xd0\xc1\xf1\x10]}\xfd\x0c\xf8\x03\xa4\xc5\xc7QRXpYs\x1e\xf3\xfbi<\xdb\x81\xe2Jb\x0c\x0b\xa3\xad\xa7Xs\xfdu\x97e#Z\x9dc\n\xf4\xae\x0f\xf6P1o>\xad>\x19\xb7\xc3J\x1c29n\xf7\xe7\x9a\xfb\x88\xcf\xc7\x99\x9e^N\x0f\x8e\x91\x9a\xe7\x81\x88\xcc\x92\xbct\\N\xc7\xe7\x1a\x1f\xedN1\x05\xfax}#\x999\xb94\x8e\xc8t6\xd7S\xe5qS^2{B\x06\x86\\\x1c\xac9N{P%\xbd`\x06\xa2\xae\xd3t\xe0\x03n\\\xba\x00\x8f\xc73\xe1\xf8\xa9\xe8\x10S\xa0\xeb\x9b[H\xcat\xd3\xe8\x0b\xd1\xd9\xde\xc6\xc8\xe9S\xfc\xfd\x9d\xb7\xe3\x1d\x18\xa2\xa1\xb9\x83\xe3\xb5\xf5\xe6\x06Y\xe8\xc9\xc7\x9d\x91Bue9\xc6v\xf9\xe2K/\x93_1\x1f1\xcd\x8d\x80\x80]W)J\x8e\xc3\xd7\xd7MII\xc9Tp\x9c\xf0\x1e1\x05\xfa\xe5W_c\xd9\xf57\xd0<*\xd3\xd5\xd5\x818\xe6\xc3\x7f\xceGrf1\x82d\x05D\x104\xe2\x1c6B\xe3!\x94\xf0\x18I\xce\x10_\xa9\x9aO\xeb\xe0(\xa2+\x01\x97E\"\xc5\xa2\xe3\x10!=!\x0e\xab\xd5\x18w\xe5[L\x81\x1e\x0f\x85\x18\x08\xc84\x8d\x8e\xd3R\xdf\x80Sqa\xb1&`\xd4\xd9$\x01$\xc9BXQ\x89sHH\x88\xc8\xaa\x8a\xdd\x1a\xa4b\x8e\x87\x11\x05\x04Q\xc2\"\xe8\xc4\x89:\xef\xbe\xf1\xbf<p\xcf=W\x9e\xf0\x85'\x88\x19\xd0\x06\xcc\x9d5u\x84C!l\xf1)\xd8C:\xc1\x90@8\xa2\xa3(\x1a\x82\x08\x16A8\x0f]\x14\xcd\xc7\x97#a\xb2\xd24j\x9b\x1bXr\xed\n\x04\xa3\x13\x1a\xd6H\x90\xdcD\x17\xa9)\xc9\xd3\xa0/%`\x00\xdcr\xe88)\xee\\Z\x0f\xd7\xb0x~5m\xddC\xa8\x1a\x88\x06\xe0\x0b\xf5c#\x86\xd1\x0c\xdc\xbaHH\x0e1\xb34\x1d\xef`?\xee\x9c\\\x13\xb4\x88F\xc7\x89#\xac\xbeaU\xcc@6\x1e$f<\xdax\x98\xad\xef\xfd\x16\xaf,R\x9a=\x8bPH%\x1cQ\xd1.\x006`\x1b\xcd\x84\xccy/\xb7X$T\xc1G\xe1\xacBD\xd1b^\x0f\x8f\r\xb3\xa8\xe4\xb3\xa3AUU\xf1\x87B\xe8\xc6\xa6)I8\x1d\xf6)Y\x90\x98\x02m\xcc\xf8\x85M\xdbH\xce(A47?\x03\xaaq\x8e8\xdfT]#b\x00\x96DS\x8b}\xa3>j\x9b\xea\xf9\xf6m\xab\x8dnXD\x91\x9d[7\xb1\xe1\xde\xf5\x9f\no\xf3\x96\xad\x94V\\\x85\x90\x94N\x9f\xac\x10\t\x06\xe8:\xf9{\xee\xba\xf5[\x17\xef\x11-\xea1\x07z\xef\xa1Z~\xb3\xb7\x96\xaa\xca\x85\xe7O\x19f\xd3M\x0f4\xe4#\x1cQP#\x01\xd2\x12l\x1c\xafkBI\xc8\xa3\xb7\xbf\x9b\xfc\x0c;\x1d\rGy\xf2\xf1\x7f\xbc\xa8\xe1\x9f\x84\xb6i\xf3\xeb,_q=\xaa \xd1:\x1aB1\xf4\\\x00\x87$\xa1t6\xb3|\xb1q\xbf\xe8\xb5\x98\x03\xfd\xd1\xb1\x06\xfa}a\xf6\xee\xdd\xc7\x82\xa5\xab>\xe1\xcf:\xba \xd0\xd5\xd1\xca\xaak\xca8\xdb\xd2DNQ\t\x9b?h\xc3\xafh\x88\xba\xcaU\x19\xe3\xdc\xb8b!\xe9ii\xff\x8f\xd8\x1b[\xdf\xe4\xab+V\xa0\x0b\x12\x1dc2{\xf6\xef\xc3b\xb5R1\xaf\x92$\x87\x9d\xbd\xef\xfc\x8a\xef\xad\xfbN\xf4(\xc7\x9aF\x1b3\x1d\x1a\x1e\xe5\xc8\x89V\xb6\xbf\xfa,I\x05\x95,X\xb2\x1ct\x01MS\xe8\xe8:\x87\xcd\"\xf0\x8b\x7f\xb9\x8b\x05\x95_\xe1'/\xbd\xca#O\xff\x16\xddb'\x12\x0e\xb0\xea\xeaL\x8e\xef\xff5\x1b\x1ez\x08\xab\xcdv\x11\xdc\xc1\xe3\xb5$g\x170(+\x84t\x08\x8e\x8daw\xb9La\xb2\x89\"\xfe\xae6V/\xad\xfar\x816f\xfb\xc6\xaf\x8f\xd1y\xf8m\xec9\x15\xe4\xce\x9agT\x8fM\xad6ED\x8b\xb0\xe3\xe7\x8f!\x88:\xf7\xfc\xf3\x13<\xff^3\x8a\xa6\xe1mo`iy6\x1f}\xf0\x0e\xba\x1aa\xdd\xbd\x0f\xb0t\xe9b\xe4\xb0Lc\xbf\x8f\xc1\x08X-V\x14]c\xff\x87\xbbYx\xcd\xb5&h\xbb p\xee\xd8!n\xbby\xf5\x97\x07t8\xacp\xb6\xb3\x87\x9d\xbf;Can:\xb5'j(\x9b\xbf\x18Q\x14\x10/nW:Gw\xff\x8a\xcaEKy\xf7X7\xdea?\x9e\x82\x1c\xc2\xe3\x01\x96\xcd/'\xdenA\xd34DI ,\xcb\xf4tw0&\x8f\x91\x96\x93N\xe9\xbc\xab\tk\x1aZDf\xd7\x8ewq\xb9\\\xc8\xfd=\xfc\xe8\x91\rQ\x85l\x18\xbf\xe2\x1a\xadj:\xdb\xde\xd9\x85\x82\x9d\xe4T7\xb2\"q\xe0\xd0\x012RS\xc8/\x9c\x89$J\xb4wt0\xa3p\x06\x18\x9e-\x08\x04\xc2*\xf5m]x{{\x18\x1a\x19\xc2\x9d(`\xcf,\xa3\xc2\x93\x8d\xdd\x0cf4S\xdb\r\x8fu:\xac\xe69\xbc\xab\xed$\x0e\xa7J~\xf5b\x04Ibh\xccOJb\".T*\xb3Sp\xda\xa3{\xcc\xbb\xa2\xa0_y\xe5\x15\x02\x8a\x93\xcc\x82\xab>\xe1\xb1\x86Dh\x1c\xad\xa9a$\xac\x12'\t8\xe2\x12\xe9\xe8\xe9\xc1a\x8fC\x105\x14\xc1N||\x1c\xfe\x8ec\xcc\xcas1\xb7\xd4\xc3\x8e\xe68<Y\xe9\xe4&'\xa0\x9a\x88A\xd0!\xcei3\xf4\x86\x13\xbf\xdf\xc3\x1d\xb7\xdd\xcc\x0b\x9b^c\xf9\x9a[\x18\n\x04\xb1;\x9d8E\x01\xbd\xab\x85\x15\xd7,\x89\xaaW_1\xd0\xdb\xb6\xbf\x83\xa7p6Gj;IH\xcd1=\xd7f\x95\xccc\xdc\xc0\xe88\xa7{\x07\x11\xbc\x07\xb9nA1\xfbj\x07h\xe9\x19C\xb28\xd1u\x85\x81sg\xe9i9\xc1?\xdc\xbf\x86Y\xf9\xa9\x0c\x05\x04\xb65\xc6\xa3\t62\x93\x13\xc9JI\xc0u\xc1\x93\xad\x92@\x92m\x94\xc35u8\xed\x12\x8eD\x17\xc5\x95U\xe8\xa2H\xedGGp9\xedH~\x1f\xeb\xd7~\xfb\xcf\x13\xf4O7>\xc7\xd1\x86>\xd2\x92\x93\xb9nY\x15}\x01\x07\xfe\xb0\x8ewx\x94\xb0.\xa2\xeb\x1a\x7f\xbbT\xa4,\xcf\x01\xba\xc4\xd6w\xf7\xf0\xc3\xa7^&\xd3\x9dKf\xaa\x8b\xff\xfe\xd7\x07\xb1K\x11t\xcd\x88\x15\x056\xfc\xecC$w\xf5\xc5p\xdd\"\x19\x92\xa1\xa3i*\xbd\xf5\xef\xb3hi%\x9e\xab\xe7\xe1HH\xa4\xb5\xee$y\xe9i\xe4{\nM\xe5\x1f\x19\xe8\xa3\xb28\x8f\xa4\xf8\xf8\xa8\xc1\xbeb\x1em\xcc\xe8\xa7\xcf\xfc\x0f\xcd-g)(.\xa7WK3Cn\xab\xd5\x86`\xe8\xac\xae\xb0~\x99NQ^\x9a\t\xdd\xf8\xae\xe96\xcev\x0fS\x94\x9b\x84 D.\x063\xc6\x87\xb1q\x91\xef?w\x141\xb9\xd8\x8c\x10\x8d\xfe\x84|\x9c9\xbe\x87\xac\x82\x0c\xd6\xdc}\x9f\tU\x10\x05\x0e\xed\xd9\xcd_\xac\\\x85,\xcbx\x07\x07\xc9\xcf\xcd\xa7\xa5\xf1\x14\xdfZ\xbe\xc8\\\xa8h\xb4+\n\xda\x98P`\\\xe6L\xfb9\xb6l\xdb\x813\xad\x90\xba\xa6VD\x8b\xd5<\x19\xfc\xfb\xba\x85\xe4\xb83\xd0\x95Q\xd0\xcf+\xef\x993\x9d\xcc,2r\x19\xe7u\xd8X\x04\xc1PeA\xa0\x7f(\xc4\x8e='\x18\xf2\x05X\xf2\xb5o\xb2\xfd\xa5')-*`\xf7\xa9v\xd6~\xff\xdf\xcc\x13\xa2\xb7\xbb\x0b\xb7;\x1b[d\x1c\x97\xd3\xc5\xe9\x96\xd3\x94\x96U k\x1a9\xa2L\xbe;+\x1a\x9c\xaf\xfc\xa9\xe3\xd3fe\"\xd4u\xce4\x1e\xa1 '\x13]\x19FD17\xb7\x9d\xef\xefg\xd5u\xcb\xce\x0f\x13\x0c\xd1\xb0\xa0\x0b\x86\xc7\xab\xf8F\xfc\xe6\xa2\xd57u0g\xf1\xcdl~\xf6\x87\x94\x15{\xd8\xdbp\x86\xb5\x8f\xfd\x17aU\xc7\x1f\xf0\x93\x94\x90@[S\x03\xc3\xe7\xba\x99[^A^~!\x83\xb2LFd\x94\x8a\x99E_\x1e\xd0\x1f\xcf\xb4\xa9\xbe\x86bO6\x9a\x12DT\x06\x11t\x91\xf7\xf7\x1e\xe6k_\xad6\xa3E\x93\xfc\xc5\xf3\xb5Fgg\x1fC#~jO\xb5\x92\x7f\xd5\x8dl\x7f\xedy\x8a3\x1d\xec\xaf?\xcb\xed\x8fod\\QIt\x18\xc5Z\x1dU\xd5Hs\xda\xb1\t\x82\x19\xf0\xf8\"\ne\t\x12\xee\xd4\x94/\x1f\xe8\xe7~\xfe4\x8b\x16\xcd\xa3\xb4\xd8\x83.\x9f3%\xe2d]\x0bs\xcbg_\xc0+\x98\xdel\xa4\x9cTEe\xef\xbe\x1aTU'-=\x9d\x01\xc5m~n\xdc\xf7&;\x8f\xd6\xb1\xee\xc7/b\xb7Z\xb0[,H\x82\x88\x16\x96\xc9IN&\xa2*\x8c\x84\xc3\x04GG\xb8\xa1|\xa6\x99\x19\x8cF\xbb\xe2\x1a\xfd\x87&U{\xe2\x183<\x99f\xe8qp\xcf\x0e23S8p\xf0(\xa9i\x19f\xd4\xe7t:(\x9cQ\x80*\x07\xc9\xcer38h\x14\nt\xb3\x00\xf0\xec\x96\x03T]\xf3u\xba\x1b\x0es\xa4\xee\x04\xdf\xf9\xc1S\xd8mVtU3\x81\xf7\xb5\x9de\xd6\xec\xd9(\x1a\x844\x95\xbec\x07Y{S\xf4\xc2\xf0\x98\x06\xdd\xd1\xd5GgG#\xf3\xcb\x8b\xb0(^\xf35\x02\xa3\xa6u\xb2\xbe\x91\xb9sf\x83\x91\xec\xd7T\x14E\xa1\xa9\xb9\x95\x88Q\xf6Bb\xdb\x91a\x82\x8e\x99Fy\x80P\xef)\x02\xe3\xbd|\xe3\xae{\xb1Z%\xe2l6\xceu\xb4S\xe0\x99a\x16\x15\x0c\xf1\xe9kib\xed\xf5\xcb\x10\xa3s\xe00})fA\xfb\x83!6\xbdu\x90H$\xc4\x1d\x7fY\x81%\xe2\xfd8\xad\xc4\x9e}\x87\xb8v\xd9\"\xd3\xd3uM\xe7Lk;\xc1P\xd8\xf4\xe6\xd7\x0f\x0c\x10p\x95^\xa8\x98\x1b\x19m\x8d\xd3\xf5\x1fr\xc7\xfdw3\xe4\xed%%9\x89\xc4\xe4\x143\x94\x97\x0c1\xf2\x8fR\x9d\x9fNzrR4\x14\xe3\xa2\xcd\x98\x05\xfd\xb3\x17\xde&\xbbp\x0e\x9a\xa2\xd1R\xb7\x97\xef\xde^\x8d\xa0\xabf-@\xd3\xa0\xbd\xbb\x9f\xbc\xac$\xda\xda\xba\x90\xe5\x08\x91\x88\x82\xd7/\xb2\xbb+\x9bPD\xb9x\xfc3\x92Q\x92\xa83\xab\xc8N\xd9\xdc2tDDI2\x03\x1d\xcd\xef\xa3\xb2 \x93\x94\x84\xe8\x05*\x1f\x93\x8eI\xd0o\xbe\xfd\x1eB|\x11\x9a.0\xe2\x0b2\xe6\x1fG\x1b\xab\xe7\xce\x9b\xe6\x12\x1e\xf7\xd3z\xb6\x93\xcc\xf4T\xda\xda:\xe9\xea\xe9!--\x9d\x84\xc4$\x8e\x9c\xd6H.\\hVb\"\xaan&\x8e\xfaG\xc6\xccS\xc5\xb9\xf6Z\xd6\xdf\xff7f\xf2_\x8b\x84\xe8m8\xc9_}c%\xd6)z=8&A?\xb1q\x13\x9e\xd9\xd5\x04\x83\x11\xbc\x83\xa3f\xa4\xd8\xd9\xe7e\xc4{\x9ae3u*\xcbrMI0\xa4\xc2\x08\xb1\x8d$\xaa\xa2\xc3\xaecA\n\xe7\\\x83\xe3B\xaaT\xd5!\xach\xd4\xb5\xf5\x12\x94\x83\xe4\xa7\x8eS]^DUY)\x89\xae\xb8\xa8J\xc5\xa5\xc6c\x12\xf4m\xf7=N\xd9\xbc\xe5\xd8-V|~?\xbdC\xc3\x04\xc3!s3\x94\xfbjyx\xddjN\x1d?LaA\x16qv\xa3\xfa\xa23\x1a\x88\xf0\xe2\x96\xdf\xf1\xf5[\x1e$'+\xc5\x94\x8f\xd0x\x04M\x87\xfa\xaeA\xfaF\xc6\x88\x0b\xb4\xf2\x9f\x8f\xfc\xdd\x94\x02\x8ei\xe9x\xf8\xf1g\x18P2\x88(\x8a\xf9\xe6\xbf\xf1\xbe]8\x1c\xc6\xa9\x8f\xb0\xf1\x07\xeb\xcd\xb7\x96\x8c\xa6\xaa\n\xe3\xc1\x80\x99\x9f\xb0\xd8\xecf\x85\xfc\xc9g^\xa3t\xfe\xb5\x88\x82H(\xa2\xd2\xe9\x1d\xa2\xa3\x7f\x18U76>/\xcf<\xf6\xd7Q\xafx\x7f\xdaJ\xc6\x9cG\xb7u\xf4\xf0\xa3\xe7\x7f\x83,\xc5_\xc8\xf3\x0b(\xaa\x82\x16\x0e\xf0\x93\r\xb7\x90\x9a\x9c\xf0\x07=r\\\x8e\xf0\xdd\x1f\xbf\x85\xe4H2\x81\x1a\x9b\x9f\xa6\xabHX@\x90y\xf0\x96j\ns3\xa6\xdc\xabc\x0e\xb4\xb7\x7f\x08_ \xcc\xd3\xaf\xecbL\xb5!\xaa\x01\x82\xaa\x8do.\xf1\xb0\xe6\xc6\x0b9\x8e\t0\xfd\xc7\xc6W\xe9\n\xa7\x9b\xf9\x12\xa3\xd2\xa2\x999\x11#X\xd7q\x0b=<\xf2@t+\xde\x7f\x12\x1e\xfd\xf1C\xbe\xf1\xd6N\x16.\xac\"?;\x9d'\x9ez\x9e\xef\xddw\xe7\xe7\xf6\xc2\x87\xfe\xe9I\"\xc93\xb1K\"Y\x19n\xda\xbd\xc3\xf8\xbdM\x14\xe5\xb812\xa8\x0f\xdf}\xd3\xe7\xb65Y\x1dc\xce\xa3'cb\x1f\xd5\x9c\xa0\xa4\xa4\x14\xbb\xcd\xc2\xf6\xf7\xf6\xf3\xf2\xebo\xb2\xf5\x97O\x98Zn\x9c\xb7m\xb6\xa9\x7f\x95\xf7\xcf\x12\xf4d,\xd6d\xdb\x98\x06=\xd9D?\xc3\xde4\xe8i\xd0SD`\x8an3\xed\xd1S\tZ\xd34\xfd\xd2?\x07\x9e\xfewl\x93\xbb\x02\xa6G\x1b\xa0\r\xb3\x9f\x84=\rz\xf2A\xff\x1f;\xd5\x0e\xd6\xdd\xb1Y\xe4\x00\x00\x00\x00IEND\xaeB`\x82",
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
            "size": 3453,
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
        "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
        "timestamp": time.time(),
        "received": "2024-4-27T22:23:29.574000+00:00",
        "environment": "prod",
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
