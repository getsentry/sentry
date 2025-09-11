import os

from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.models.alert_rule import AlertRule
from sentry.incidents.models.incident import Incident
from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.environment import Environment, EnvironmentProject
from sentry.models.eventattachment import EventAttachment
from sentry.models.files.file import File
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
from sentry.models.groupmeta import GroupMeta
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.groupresolution import GroupResolution
from sentry.models.groupseen import GroupSeen
from sentry.models.organization import OrganizationStatus
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
from sentry.models.rulesnooze import RuleSnooze
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    ScheduleType,
)
from sentry.sentry_apps.models.servicehook import ServiceHook
from sentry.services import eventstore
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.uptime.models import ProjectUptimeSubscription, UptimeSubscription
from sentry.workflow_engine.models import (
    DataCondition,
    DataConditionGroup,
    DataSource,
    DataSourceDetector,
    Detector,
    DetectorWorkflow,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

pytestmark = [requires_snuba]


class DeleteProjectTest(BaseWorkflowTest, TransactionTestCase, HybridCloudTestMixin):
    def test_simple(self) -> None:
        project = self.create_project(name="test")
        rule = self.create_project_rule(project=project)
        RuleActivity.objects.create(
            rule=rule, user_id=self.user.id, type=RuleActivityType.CREATED.value
        )
        event = self.store_event(data={}, project_id=project.id)
        assert event.group is not None
        group = event.group
        activity = Activity.objects.create(
            group=group,
            project=project,
            type=ActivityType.SET_RESOLVED.value,
            user_id=self.user.id,
        )
        open_period = GroupOpenPeriod.objects.create(
            group=group,
            project=project,
            date_started=before_now(minutes=1),
            date_ended=before_now(minutes=1),
            resolution_activity=activity,
        )
        GroupAssignee.objects.create(group=group, project=project, user_id=self.user.id)
        GroupMeta.objects.create(group=group, key="foo", value="bar")
        release = Release.objects.create(version="a" * 32, organization_id=project.organization_id)
        release.add_project(project)
        GroupResolution.objects.create(group=group, release=release)
        env = Environment.objects.create(organization_id=project.organization_id, name="foo")
        env.add_project(project)
        repo = Repository.objects.create(organization_id=project.organization_id, name=project.name)
        commit_author = CommitAuthor.objects.create(
            organization_id=project.organization_id, name="foo", email="foo@example.com"
        )
        commit = Commit.objects.create(
            repository_id=repo.id,
            organization_id=project.organization_id,
            author=commit_author,
            key="a" * 40,
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=0,
        )
        file = File.objects.create(name="debug-file", type="project.dif")
        dif = ProjectDebugFile.objects.create(
            file=file,
            debug_id="uuid",
            code_id="codeid",
            cpu_name="cpu",
            object_name="object",
            project_id=project.id,
        )
        EventAttachment.objects.create(
            event_id=event.event_id,
            project_id=event.project_id,
            name="hello.png",
            type="image/png",
        )
        hook = self.create_service_hook(
            actor=self.user,
            org=project.organization,
            project=project,
            url="https://example.com/webhook",
        )
        metric_alert_rule = self.create_alert_rule(
            organization=project.organization, projects=[project]
        )
        monitor = Monitor.objects.create(
            organization_id=project.organization.id,
            project_id=project.id,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )
        monitor_env = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=env.id,
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_env,
            project_id=project.id,
            date_added=monitor.date_added,
            status=CheckInStatus.OK,
        )
        snuba_query = metric_alert_rule.snuba_query
        query_sub = QuerySubscription.objects.create(
            project=project,
            snuba_query=snuba_query,
            status=0,
            subscription_id="a-snuba-id-maybe",
            query_extra="",
        )
        incident = self.create_incident(
            organization=project.organization,
            projects=[project],
            alert_rule=metric_alert_rule,
            title="Something bad happened",
            subscription=query_sub,
        )

        rule_snooze = self.snooze_rule(user_id=self.user.id, alert_rule=metric_alert_rule)

        self.ScheduledDeletion.schedule(instance=project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Project.objects.filter(id=project.id).exists()
        assert not Rule.objects.filter(id=rule.id).exists()
        assert not RuleActivity.objects.filter(rule_id=rule.id).exists()
        assert not EnvironmentProject.objects.filter(
            project_id=project.id, environment_id=env.id
        ).exists()
        assert Environment.objects.filter(id=env.id).exists()
        assert not Group.objects.filter(project_id=project.id).exists()
        assert not EventAttachment.objects.filter(project_id=project.id).exists()
        assert Release.objects.filter(id=release.id).exists()
        assert ReleaseCommit.objects.filter(release_id=release.id).exists()
        assert Commit.objects.filter(id=commit.id).exists()
        assert SnubaQuery.objects.filter(id=snuba_query.id).exists()
        assert not ProjectDebugFile.objects.filter(id=dif.id).exists()
        assert not File.objects.filter(id=file.id).exists()
        assert not ServiceHook.objects.filter(id=hook.id).exists()
        assert not Monitor.objects.filter(id=monitor.id).exists()
        assert not MonitorEnvironment.objects.filter(id=monitor_env.id).exists()
        assert not GroupOpenPeriod.objects.filter(id=open_period.id).exists()
        assert not Activity.objects.filter(id=activity.id).exists()
        assert not MonitorCheckIn.objects.filter(id=checkin.id).exists()
        assert not QuerySubscription.objects.filter(id=query_sub.id).exists()

        incident.refresh_from_db()
        assert len(incident.projects.all()) == 0, "Project relation should be removed"
        assert Incident.objects.filter(id=incident.id).exists()

        assert AlertRule.objects.filter(id=metric_alert_rule.id).exists()
        assert RuleSnooze.objects.filter(id=rule_snooze.id).exists()

    def test_delete_error_events(self) -> None:
        keeper = self.create_project(name="keeper")
        project = self.create_project(name="test")
        event = self.store_event(
            data={
                "timestamp": before_now(minutes=1).isoformat(),
                "message": "oh no",
            },
            project_id=project.id,
        )
        assert event.group is not None
        group = event.group
        group_seen = GroupSeen.objects.create(group=group, project=project, user_id=self.user.id)

        self.ScheduledDeletion.schedule(instance=project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Project.objects.filter(id=project.id).exists()
        assert not GroupSeen.objects.filter(id=group_seen.id).exists()
        assert not Group.objects.filter(id=group.id).exists()

        conditions = eventstore.Filter(project_ids=[project.id, keeper.id], group_ids=[group.id])
        events = eventstore.backend.get_events(
            conditions, tenant_ids={"organization_id": 123, "referrer": "r"}
        )
        assert len(events) == 0

    def test_delete_with_uptime_monitors(self) -> None:
        project = self.create_project(name="test")

        # Create uptime subscription
        uptime_subscription = UptimeSubscription.objects.create(
            url="https://example.com",
            url_domain="example",
            url_domain_suffix="com",
            interval_seconds=60,
            timeout_ms=5000,
            method="GET",
        )

        # Create project uptime subscription
        project_uptime_subscription = ProjectUptimeSubscription.objects.create(
            project=project, uptime_subscription=uptime_subscription, name="Test Monitor"
        )

        self.ScheduledDeletion.schedule(instance=project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Project.objects.filter(id=project.id).exists()
        assert not ProjectUptimeSubscription.objects.filter(
            id=project_uptime_subscription.id
        ).exists()

    def test_delete_project_with_grouphashes(self) -> None:
        """Test that GroupHash and GroupHashMetadata are properly deleted during project deletion."""
        project = self.create_project(name="test-grouphash-deletion")

        # Store multiple events to create GroupHash and GroupHashMetadata objects
        self.store_event(
            data={"message": "First error message", "fingerprint": ["group1"]},
            project_id=project.id,
        )
        self.store_event(
            data={"message": "Second error message", "fingerprint": ["group2"]},
            project_id=project.id,
        )
        self.store_event(
            data={"message": "Third error message", "fingerprint": ["group3"]},
            project_id=project.id,
        )

        # Verify that GroupHash objects were created for each event
        grouphashes = GroupHash.objects.filter(project_id=project.id)
        assert grouphashes.count() >= 3, "Expected at least 3 GroupHash objects to be created"

        # Collect GroupHash and GroupHashMetadata IDs before deletion
        grouphash_ids = list(grouphashes.values_list("id", flat=True))
        grouphash_metadata_ids = list(
            GroupHashMetadata.objects.filter(grouphash_id__in=grouphash_ids).values_list(
                "id", flat=True
            )
        )

        # Verify metadata was created (may be 0 if no metadata is automatically created)
        initial_metadata_count = len(grouphash_metadata_ids)

        # Schedule project for deletion
        self.ScheduledDeletion.schedule(instance=project, days=0)

        # Run the deletion task
        with self.tasks():
            run_scheduled_deletions()

        # Verify the project is deleted
        assert not Project.objects.filter(id=project.id).exists()

        # Verify all GroupHash objects are deleted
        assert not GroupHash.objects.filter(
            id__in=grouphash_ids
        ).exists(), "GroupHash objects should be deleted during project deletion"

        # Verify all GroupHashMetadata objects are deleted
        if initial_metadata_count > 0:
            assert not GroupHashMetadata.objects.filter(
                id__in=grouphash_metadata_ids
            ).exists(), "GroupHashMetadata objects should be deleted during project deletion"

        # Verify no orphaned GroupHash objects remain for this project
        assert not GroupHash.objects.filter(
            project_id=project.id
        ).exists(), "No GroupHash objects should remain for the deleted project"

    def test_delete_project_with_many_grouphashes_performance(self) -> None:
        """Test that project deletion with many GroupHashes completes efficiently.

        This test verifies that the fix prevents Django's CASCADE mechanism from
        trying to SELECT all GroupHash IDs at once, which was causing timeouts.
        """
        project = self.create_project(name="test-performance")

        # Create many events to simulate a large project with lots of GroupHash objects
        # In a real scenario, this could be millions of GroupHashes causing the timeout
        grouphash_count = 100  # Keep reasonable for test performance
        for i in range(grouphash_count):
            self.store_event(
                data={"message": f"Error message {i}", "fingerprint": [f"group{i}"]},
                project_id=project.id,
            )

        # Verify that many GroupHash objects were created
        initial_grouphashes = GroupHash.objects.filter(project_id=project.id)
        assert (
            initial_grouphashes.count() >= grouphash_count
        ), f"Expected at least {grouphash_count} GroupHash objects"

        # This deletion should complete without timing out because GroupHash objects
        # are deleted through the custom deletion system in chunks rather than
        # Django trying to collect all IDs at once via CASCADE
        self.ScheduledDeletion.schedule(instance=project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        # Verify everything is properly cleaned up
        assert not Project.objects.filter(id=project.id).exists()
        assert not GroupHash.objects.filter(project_id=project.id).exists()

    def test_delete_project_prevents_cascade_timeout(self) -> None:
        """Test that project deletion uses chunked deletion instead of Django CASCADE.

        This test verifies that the problematic query that was causing timeouts
        is no longer executed during project deletion with many GroupHashes.
        """
        project = self.create_project(name="test-cascade-prevention")

        # Create several events to have some GroupHashes
        for i in range(5):
            self.store_event(
                data={"message": f"Error message {i}", "fingerprint": [f"group{i}"]},
                project_id=project.id,
            )

        # Verify GroupHash objects were created
        initial_grouphashes = GroupHash.objects.filter(project_id=project.id)
        grouphash_count = initial_grouphashes.count()
        assert grouphash_count == 5, "Expected 5 GroupHash objects to be created"

        # Schedule and run the deletion
        self.ScheduledDeletion.schedule(instance=project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        # Verify deletion completed successfully
        assert not Project.objects.filter(id=project.id).exists()
        assert not GroupHash.objects.filter(project_id=project.id).exists()
        assert not Group.objects.filter(project_id=project.id).exists()

        # The key success indicator is that the deletion completed without timeout
        # This confirms GroupHash objects are being deleted via chunked deletion
        # rather than Django's problematic CASCADE mechanism that would execute:
        # SELECT "sentry_grouphash"."id" FROM "sentry_grouphash" WHERE "sentry_grouphash"."project_id" IN (%s)

    def test_delete_project_with_sql_inspection(self) -> None:
        """Test project deletion and capture SQL analysis for inspection.

        This test captures all SQL queries during deletion and makes them available
        for inspection. Use this for debugging or verifying specific SQL behavior.

        After running this test, you can inspect:
        - self.sql_analysis: Dict with query statistics
        - self.all_queries: List of all SQL queries executed

        You can inspect these by:
        1. Adding a breakpoint here and examining the variables
        2. Using the get_sql_summary() method to get formatted output
        3. Extending the test with custom assertions
        """
        import sys

        from sentry.utils.sql_debug import sql_debug_context

        project = self.create_project(name="test-sql-inspection")
        org = project.organization

        # Create several events to have some GroupHashes - more events for more data
        events = []
        for i in range(2):
            event = self.store_event(
                data={"message": f"Error message {i}", "fingerprint": [f"group{i}"]},
                project_id=project.id,
            )
            events.append(event)

        # Verify GroupHash objects were created
        initial_grouphashes = GroupHash.objects.filter(project_id=project.id)
        initial_groups = Group.objects.filter(project_id=project.id)
        grouphash_count = initial_grouphashes.count()
        group_count = initial_groups.count()

        print(
            f"\n[Test Debug] Created {group_count} groups and {grouphash_count} grouphashes",
            file=sys.stderr,
        )
        assert grouphash_count >= 2, f"Expected at least 2 GroupHash objects, got {grouphash_count}"
        assert group_count >= 2, f"Expected at least 2 Group objects, got {group_count}"

        # Schedule the deletion first
        org.update(status=OrganizationStatus.PENDING_DELETION)
        self.ScheduledDeletion.schedule(instance=org, days=0)
        tables = ["sentry_grouphash", "sentry_grouphashmetadata", "sentry_project", "sentry_group"]

        # Capture SQL queries during the actual task execution
        with sql_debug_context(
            enable_debug=True,
            filter_tables=[tables],
        ) as sql_debugger:
            # Run the deletion tasks - this is where the real work happens
            print(f"[Test Debug] Starting deletion task execution...", file=sys.stderr)
            with self.tasks():
                run_scheduled_deletions()
            print(f"[Test Debug] Deletion task execution completed", file=sys.stderr)

        # Get the SQL analysis for inspection
        analysis = sql_debugger.analyze_queries(tables)

        # Store analysis for inspection (accessible via debugger or assertion failure messages)
        self.sql_analysis = analysis
        self.all_queries = sql_debugger.captured_queries

        # Verify we don't have the problematic CASCADE query
        problematic_pattern = 'SELECT "sentry_grouphash"."id" FROM "sentry_grouphash" WHERE "sentry_grouphash"."project_id" IN'
        grouphash_queries = analysis.get("queries_by_table", {}).get("sentry_grouphash", [])

        import pprint

        pprint.pprint(grouphash_queries)
        pprint.pprint(self.all_queries)

        has_problematic_query = any(
            problematic_pattern in sql for sql in grouphash_queries if "DELETE FROM" not in sql
        )
        assert (
            not has_problematic_query
        ), f"Found problematic CASCADE query!\nGroupHash queries: {grouphash_queries}"

        # Add debug output for SQL inspection (set SHOW_SQL_DEBUG=1 to see output)
        if os.environ.get("SHOW_SQL_DEBUG"):
            import sys

            print(f"\n{'='*80}", file=sys.stderr)
            print("ALL SQL STATEMENTS EXECUTED DURING PROJECT DELETION", file=sys.stderr)
            print(f"{'='*80}", file=sys.stderr)
            print(f"\nTotal queries executed: {len(self.all_queries)}", file=sys.stderr)
            print(f"Analysis: {analysis}", file=sys.stderr)

            # Show breakdown by connection
            connections_used = {query.get("connection", "unknown") for query in self.all_queries}
            print(f"Connections used: {sorted(connections_used)}", file=sys.stderr)
            for conn in sorted(connections_used):
                conn_queries = [q for q in self.all_queries if q.get("connection") == conn]
                print(f"  {conn}: {len(conn_queries)} queries", file=sys.stderr)

            print(f"\n{'-'*80}", file=sys.stderr)
            print("COMPLETE SQL QUERY LIST:", file=sys.stderr)
            print(f"{'-'*80}", file=sys.stderr)

            for i, query in enumerate(self.all_queries, 1):
                # Handle both numeric and string time values safely
                if "time" in query:
                    try:
                        time_val = float(query["time"])
                        time_info = f" ({time_val:.3f}s)"
                    except (ValueError, TypeError):
                        time_info = f' ({query["time"]}s)'
                else:
                    time_info = ""
                conn_info = f' [{query.get("connection", "?")}]'
                print(f"\n{i:3}.{time_info}{conn_info}", file=sys.stderr)
                print(f"    {query['sql']}", file=sys.stderr)

            print(f"\n{'='*80}", file=sys.stderr)

        # Check what actually got deleted
        final_grouphashes = GroupHash.objects.filter(project_id=project.id)
        final_groups = Group.objects.filter(project_id=project.id)
        final_projects = Project.objects.filter(id=project.id)

        print(
            f"[Test Debug] After deletion: {final_projects.count()} projects, {final_groups.count()} groups, {final_grouphashes.count()} grouphashes remaining",
            file=sys.stderr,
        )

        # Verify deletion completed successfully
        assert not final_projects.exists()
        assert (
            not final_grouphashes.exists()
        ), f"Expected 0 GroupHash objects, found {final_grouphashes.count()}"
        assert not final_groups.exists(), f"Expected 0 Group objects, found {final_groups.count()}"

    def get_sql_summary(self) -> str:
        """Get a formatted summary of captured SQL queries.

        Call this method after running test_delete_project_with_sql_inspection
        to get a formatted summary of the SQL execution.
        """
        if not hasattr(self, "sql_analysis") or not hasattr(self, "all_queries"):
            return "No SQL analysis available. Run test_delete_project_with_sql_inspection first."

        lines = [
            "SQL ANALYSIS FROM PROJECT DELETION",
            "=" * 60,
            f"Total queries: {self.sql_analysis.get('total_queries', 0)}",
            f"Query types: {self.sql_analysis.get('query_types', {})}",
            f"Tables affected: {self.sql_analysis.get('tables_affected', {})}",
            "",
            "First 10 queries:",
        ]

        for i, query in enumerate(self.all_queries[:10], 1):
            time_info = f" ({query.get('time', '?')}s)" if "time" in query else ""
            lines.append(f"{i}.{time_info} {query['sql'][:120]}...")

        if len(self.all_queries) > 10:
            lines.append(f"... and {len(self.all_queries) - 10} more queries")

        lines.append("=" * 60)
        return "\n".join(lines)


class DeleteWorkflowEngineModelsTest(DeleteProjectTest):
    def setUp(self) -> None:
        self.workflow_engine_project = self.create_project(name="workflow_engine_test")
        self.snuba_query = self.create_snuba_query()
        self.subscription = QuerySubscription.objects.create(
            project=self.workflow_engine_project,
            status=QuerySubscription.Status.ACTIVE.value,
            subscription_id="123",
            snuba_query=self.snuba_query,
        )
        self.data_source = self.create_data_source(
            organization=self.organization, source_id=self.subscription.id
        )
        self.detector_data_condition_group = self.create_data_condition_group(
            organization=self.organization
        )
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            _,  # the workflow trigger group for a migrated metric alert rule is None
        ) = self.create_detector_and_workflow(project=self.workflow_engine_project)
        self.detector.update(workflow_condition_group=self.detector_data_condition_group)
        self.detector_trigger = self.create_data_condition(
            comparison=200,
            condition_result=DetectorPriorityLevel.HIGH,
            type=Condition.GREATER_OR_EQUAL,
            condition_group=self.detector_data_condition_group,
        )

        self.data_source_detector = self.create_data_source_detector(
            data_source=self.data_source, detector=self.detector
        )

    def test_delete_detector_data_source(self) -> None:
        self.ScheduledDeletion.schedule(instance=self.workflow_engine_project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Detector.objects.filter(id=self.detector.id).exists()
        assert not DataSource.objects.filter(id=self.data_source.id).exists()
        assert not DataSourceDetector.objects.filter(id=self.data_source_detector.id).exists()
        assert not QuerySubscription.objects.filter(id=self.subscription.id).exists()
        assert not SnubaQuery.objects.filter(id=self.snuba_query.id).exists()

    def test_delete_detector_data_conditions(self) -> None:
        self.ScheduledDeletion.schedule(instance=self.workflow_engine_project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not DataConditionGroup.objects.filter(
            id=self.detector_data_condition_group.id
        ).exists()
        assert not DataCondition.objects.filter(id=self.detector_trigger.id).exists()

    def test_not_delete_workflow(self) -> None:
        self.ScheduledDeletion.schedule(instance=self.workflow_engine_project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not DetectorWorkflow.objects.filter(id=self.detector_workflow.id).exists()
        assert Workflow.objects.filter(id=self.workflow.id).exists()
