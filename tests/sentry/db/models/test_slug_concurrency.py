import threading
import time
from collections.abc import Callable
from typing import Any

import pytest
from django.db import IntegrityError, connections, router, transaction
from django.test import override_settings

from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.monitors.models import Monitor, ScheduleType
from sentry.testutils.cases import TransactionTestCase

WAIT_TIMEOUT = 10


def create_concurrently(using: str, create: Callable[[], Any]) -> tuple[Any, Any]:
    """
    Run `create` two times in two threads, each time in its own transaction.

    The first transaction stays open until the second create waits for a database lock, then it commits.
    """
    results: dict[str, Any] = {}
    errors: list[BaseException] = []
    first_created = threading.Event()
    second_pid: list[int] = []

    def run_first() -> None:
        try:
            with transaction.atomic(using=using):
                results["first"] = create()
                first_created.set()
                with connections[using].cursor() as cursor:
                    deadline = time.monotonic() + WAIT_TIMEOUT
                    while time.monotonic() < deadline:
                        if second_pid:
                            cursor.execute(
                                "SELECT count(*) FROM pg_locks WHERE pid = %s AND NOT granted",
                                [second_pid[0]],
                            )
                            if cursor.fetchone()[0]:
                                break
                        time.sleep(0.05)
                    else:
                        raise AssertionError("The second create did not wait for a lock")
        except BaseException as e:
            errors.append(e)
        finally:
            first_created.set()
            for conn in connections.all():
                conn.close()

    def run_second() -> None:
        try:
            assert first_created.wait(WAIT_TIMEOUT)
            with connections[using].cursor() as cursor:
                cursor.execute("SELECT pg_backend_pid()")
                second_pid.append(cursor.fetchone()[0])
            with transaction.atomic(using=using):
                results["second"] = create()
        except BaseException as e:
            errors.append(e)
        finally:
            for conn in connections.all():
                conn.close()

    threads = [threading.Thread(target=run_first), threading.Thread(target=run_second)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(WAIT_TIMEOUT * 2)

    if errors:
        raise errors[0]
    return results["first"], results["second"]


class ConcurrentSlugTest(TransactionTestCase):
    def test_projects_get_different_slugs(self) -> None:
        organization = self.create_organization()

        first, second = create_concurrently(
            router.db_for_write(Project),
            lambda: Project.objects.create(organization=organization, name="Backend"),
        )

        assert first.slug == "backend"
        assert second.slug.startswith("backend-")
        assert set(
            Project.objects.filter(organization=organization).values_list("slug", flat=True)
        ) == {first.slug, second.slug}

    def test_other_integrity_error_is_raised(self) -> None:
        # Monitor does not use snowflake IDs, so save_with_snowflake_id does not catch the
        # error first.
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        first = self.create_monitor(organization=organization, project=project, name="First")

        monitor = Monitor(
            organization_id=organization.id,
            project_id=project.id,
            name="Second",
            guid=first.guid,
            config=first.config,
        )
        with pytest.raises(IntegrityError):
            monitor.save()

        # The slug was free, so the slug is not picked again.
        assert monitor.slug == "second"

    def test_teams_get_different_slugs(self) -> None:
        organization = self.create_organization()

        first, second = create_concurrently(
            router.db_for_write(Team),
            lambda: Team.objects.create(organization=organization, name="Platform"),
        )

        assert first.slug == "platform"
        assert second.slug.startswith("platform-")
        assert set(
            Team.objects.filter(organization=organization).values_list("slug", flat=True)
        ) == {first.slug, second.slug}

    def test_organizations_get_different_slugs(self) -> None:
        # The two names are different, but they give the same slug.
        names = iter(["Acme Concurrency", "acme concurrency!"])

        def create_organization() -> Organization:
            # Do not flush the outbox in the thread. The flush calls a remote service.
            with outbox_context(flush=False):
                return Organization.objects.create(name=next(names))

        first, second = create_concurrently(router.db_for_write(Organization), create_organization)

        assert first.slug == "acme-concurrency"
        assert second.slug.startswith("acme-concurrency-")
        assert Organization.objects.filter(slug__in=[first.slug, second.slug]).count() == 2

    # With snowflake IDs, save_with_snowflake_id catches the IntegrityError first, so
    # get_or_create cannot recover.
    @override_settings(SENTRY_USE_SNOWFLAKE=False)
    def test_organization_get_or_create_with_explicit_slug_returns_existing(self) -> None:
        def get_or_create_organization() -> Organization:
            with outbox_context(flush=False):
                organization, _ = Organization.objects.get_or_create(
                    slug="acme-race", defaults={"name": "Acme"}
                )
                return organization

        first, second = create_concurrently(
            router.db_for_write(Organization), get_or_create_organization
        )

        assert first.id == second.id
        assert Organization.objects.filter(slug__startswith="acme-race").count() == 1

    def test_monitors_get_different_slugs(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        first, second = create_concurrently(
            router.db_for_write(Monitor),
            lambda: Monitor.objects.create(
                organization_id=organization.id,
                project_id=project.id,
                name="Nightly Job",
                config={
                    "schedule": [1, "day"],
                    "schedule_type": ScheduleType.INTERVAL,
                    "checkin_margin": None,
                    "max_runtime": None,
                },
            ),
        )

        assert first.slug == "nightly-job"
        assert second.slug.startswith("nightly-job-")
        assert set(
            Monitor.objects.filter(organization_id=organization.id).values_list("slug", flat=True)
        ) == {first.slug, second.slug}
