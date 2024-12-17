from __future__ import annotations

import io
import tempfile
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from functools import cached_property, cmp_to_key
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.apps import apps
from django.db import connections, router
from django.utils import timezone
from sentry_relay.auth import generate_key_pair

from sentry.backup.crypto import (
    KeyManagementServiceClient,
    LocalFileDecryptor,
    LocalFileEncryptor,
    decrypt_encrypted_tarball,
)
from sentry.backup.dependencies import (
    NormalizedModelName,
    get_model,
    reversed_dependencies,
    sorted_dependencies,
)
from sentry.backup.exports import (
    ExportCheckpointer,
    export_in_config_scope,
    export_in_global_scope,
    export_in_organization_scope,
    export_in_user_scope,
)
from sentry.backup.findings import ComparatorFindings
from sentry.backup.helpers import Printer
from sentry.backup.imports import import_in_global_scope
from sentry.backup.scopes import ExportScope
from sentry.backup.validate import validate
from sentry.data_secrecy.models import DataSecrecyWaiver
from sentry.db.models.paranoia import ParanoidModel
from sentry.incidents.models.alert_rule import AlertRuleMonitorTypeInt
from sentry.incidents.models.incident import (
    IncidentActivity,
    IncidentSnapshot,
    IncidentTrigger,
    PendingIncidentSnapshot,
    TimeSeriesSnapshot,
)
from sentry.incidents.utils.types import AlertRuleActivationConditionType
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.models.project_integration import ProjectIntegration
from sentry.models.activity import Activity
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apigrant import ApiGrant
from sentry.models.apikey import ApiKey
from sentry.models.apitoken import ApiToken
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.counter import Counter
from sentry.models.dashboard import Dashboard, DashboardFavoriteUser, DashboardTombstone
from sentry.models.dashboard_permissions import DashboardPermissions
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetQuery,
    DashboardWidgetQueryOnDemand,
    DashboardWidgetTypes,
)
from sentry.models.dynamicsampling import CustomDynamicSamplingRule
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupbookmark import GroupBookmark
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.groupseen import GroupSeen
from sentry.models.groupshare import GroupShare
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.options.option import ControlOption, Option
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.options.project_template_option import ProjectTemplateOption
from sentry.models.organization import Organization
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.models.projectredirect import ProjectRedirect
from sentry.models.projecttemplate import ProjectTemplate
from sentry.models.recentsearch import RecentSearch
from sentry.models.relay import Relay, RelayUsage
from sentry.models.rule import NeglectedRule, RuleActivity, RuleActivityType
from sentry.models.savedsearch import SavedSearch, Visibility
from sentry.models.search_common import SearchType
from sentry.monitors.models import Monitor, MonitorType, ScheduleType
from sentry.nodestore.django.models import Node
from sentry.sentry_apps.logic import SentryAppUpdater
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.tempest.models import TempestCredentials
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.fixtures import Fixtures
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.token import AuthTokenType
from sentry.users.models.authenticator import Authenticator
from sentry.users.models.user import User
from sentry.users.models.user_option import UserOption
from sentry.users.models.userip import UserIP
from sentry.users.models.userrole import UserRole, UserRoleUser
from sentry.utils import json
from sentry.workflow_engine.models import (
    Action,
    AlertRuleDetector,
    AlertRuleTriggerDataCondition,
    AlertRuleWorkflow,
    DataConditionGroup,
)

__all__ = [
    "export_to_file",
    "ValidationError",
]

NOOP_PRINTER = Printer()


class FakeKeyManagementServiceClient:
    """
    Fake version of `KeyManagementServiceClient` that removes the two network calls we rely on: the
    `Transport` setup on class construction, and the call to the hosted `asymmetric_decrypt`
    endpoint.
    """

    asymmetric_decrypt = MagicMock()
    get_public_key = MagicMock()

    @staticmethod
    def crypto_key_version_path(**kwargs) -> str:
        return KeyManagementServiceClient.crypto_key_version_path(**kwargs)


class ValidationError(Exception):
    def __init__(self, info: ComparatorFindings):
        super().__init__(info.pretty())
        self.info = info


def export_to_file(
    path: Path,
    scope: ExportScope,
    filter_by: set[str] | None = None,
    checkpointer: ExportCheckpointer | None = None,
) -> Any:
    """
    Helper function that exports the current state of the database to the specified file.
    """

    json_file_path = str(path)
    with open(json_file_path, "wb+") as tmp_file:
        # These functions are just thin wrappers, but its best to exercise them directly anyway in
        # case that ever changes.
        if scope == ExportScope.Global:
            export_in_global_scope(
                tmp_file,
                printer=NOOP_PRINTER,
                checkpointer=checkpointer,
            )
        elif scope == ExportScope.Config:
            export_in_config_scope(
                tmp_file,
                printer=NOOP_PRINTER,
                checkpointer=checkpointer,
            )
        elif scope == ExportScope.Organization:
            export_in_organization_scope(
                tmp_file,
                org_filter=filter_by,
                printer=NOOP_PRINTER,
                checkpointer=checkpointer,
            )
        elif scope == ExportScope.User:
            export_in_user_scope(
                tmp_file,
                user_filter=filter_by,
                printer=NOOP_PRINTER,
                checkpointer=checkpointer,
            )
        else:
            raise AssertionError(f"Unknown `ExportScope`: `{scope.name}`")

    with open(json_file_path) as tmp_file:
        output = json.load(tmp_file)
    return output


def generate_rsa_key_pair() -> tuple[bytes, bytes]:
    private_key = rsa.generate_private_key(
        public_exponent=65537, key_size=2048, backend=default_backend()
    )
    public_key = private_key.public_key()
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_key_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return (private_key_pem, public_key_pem)


def export_to_encrypted_tarball(
    path: Path,
    scope: ExportScope,
    *,
    rsa_key_pair: tuple[bytes, bytes],
    filter_by: set[str] | None = None,
    checkpointer: ExportCheckpointer | None = None,
) -> Any:
    """
    Helper function that exports the current state of the database to the specified encrypted
    tarball.
    """

    # Generate a public-private key pair.
    (private_key_pem, public_key_pem) = rsa_key_pair
    public_key_fp = io.BytesIO(public_key_pem)

    # Run the appropriate `export_in_...` command with encryption enabled.
    tar_file_path = str(path)
    with open(tar_file_path, "wb+") as tmp_file:
        # These functions are just thin wrappers, but its best to exercise them directly anyway in
        # case that ever changes.
        if scope == ExportScope.Global:
            export_in_global_scope(
                tmp_file,
                encryptor=LocalFileEncryptor(public_key_fp),
                printer=NOOP_PRINTER,
                checkpointer=checkpointer,
            )
        elif scope == ExportScope.Config:
            export_in_config_scope(
                tmp_file,
                encryptor=LocalFileEncryptor(public_key_fp),
                printer=NOOP_PRINTER,
                checkpointer=checkpointer,
            )
        elif scope == ExportScope.Organization:
            export_in_organization_scope(
                tmp_file,
                encryptor=LocalFileEncryptor(public_key_fp),
                org_filter=filter_by,
                printer=NOOP_PRINTER,
                checkpointer=checkpointer,
            )
        elif scope == ExportScope.User:
            export_in_user_scope(
                tmp_file,
                encryptor=LocalFileEncryptor(public_key_fp),
                user_filter=filter_by,
                printer=NOOP_PRINTER,
                checkpointer=checkpointer,
            )
        else:
            raise AssertionError(f"Unknown `ExportScope`: `{scope.name}`")

    # Read the files in the generated tarball. This bit of code assume the file names, but that is
    # part of the encrypt/decrypt tar-ing API, so we need to ensure that these exact names are
    # present and contain the data we expect.
    with open(tar_file_path, "rb") as f:
        return json.loads(
            decrypt_encrypted_tarball(f, LocalFileDecryptor.from_bytes(private_key_pem))
        )


def is_control_model(model):
    meta = model._meta
    return not hasattr(meta, "silo_limit") or SiloMode.CONTROL in meta.silo_limit.modes


def clear_model(model, *, reset_pks: bool):
    using = router.db_for_write(model)
    with unguarded_write(using=using):
        manager = model.with_deleted if issubclass(model, ParanoidModel) else model.objects
        manager.all().delete()

        # TODO(getsentry/team-ospo#190): Remove the "Node" kludge below in favor of a more permanent
        # solution.
        if reset_pks and model is not Node:
            table = model._meta.db_table
            seq = f"{table}_id_seq"
            with connections[using].cursor() as cursor:
                cursor.execute("SELECT setval(%s, 1, false)", [seq])


@assume_test_silo_mode(SiloMode.REGION)
def clear_database(*, reset_pks: bool = False):
    """
    Deletes all models we care about from the database, in a sequence that ensures we get no
    foreign key errors.
    """
    reversed = reversed_dependencies()
    for model in reversed:
        if is_control_model(model):
            with assume_test_silo_mode(SiloMode.CONTROL):
                clear_model(model, reset_pks=reset_pks)
        else:
            clear_model(model, reset_pks=reset_pks)

    # Clear remaining tables that are not explicitly in Sentry's own model dependency graph.
    for model in set(apps.get_models()) - set(reversed):
        # We don't know which silo these models reside in, so try both.
        try:
            with assume_test_silo_mode(SiloMode.CONTROL):
                clear_model(model, reset_pks=False)
        except Exception:
            pass

        try:
            clear_model(model, reset_pks=False)
        except Exception:
            pass


def import_export_then_validate(method_name: str, *, reset_pks: bool = True) -> Any:
    """
    Test helper that validates that data imported from an export of the current state of the test
    database correctly matches the actual outputted export data.
    """

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_expect = Path(tmpdir).joinpath(f"{method_name}.expect.json")
        tmp_actual = Path(tmpdir).joinpath(f"{method_name}.actual.json")

        # Export the current state of the database into the "expected" temporary file, then
        # parse it into a JSON object for comparison.
        expect = export_to_file(tmp_expect, ExportScope.Global)
        clear_database(reset_pks=reset_pks)

        # Write the contents of the "expected" JSON file into the now clean database.
        with open(tmp_expect, "rb") as tmp_file:
            import_in_global_scope(tmp_file, printer=NOOP_PRINTER)

        # Validate that the "expected" and "actual" JSON matches.
        actual = export_to_file(tmp_actual, ExportScope.Global)
        res = validate(expect, actual)
        if res.findings:
            raise ValidationError(res)

        # Ensure that the "reset" behavior was tested in the manner we expect.
        for i, expect_entry in enumerate(expect):
            model_name = expect_entry["model"]
            expect_pk = expect_entry["pk"]
            actual_pk = actual[i]["pk"]
            if reset_pks and expect_pk != actual_pk:
                expect_pk
                AssertionError(
                    f"At model `{model_name}`, the expected `pk` of `{expect_pk}` was not equal to the actual `pk` of `{actual_pk}`, even though `reset_pks = True`"
                )
            elif not reset_pks and expect_pk == actual_pk:
                expect_pk
                AssertionError(
                    f"At model `{model_name}`, the expected `pk` of `{expect_pk}` was equal to the actual `pk` of `{actual_pk}`, even though `reset_pks = False`"
                )

    return actual


class ExhaustiveFixtures(Fixtures):
    """Helper fixtures for creating 'exhaustive' (that is, maximally filled out, with all child models included) versions of common top-level models like users, organizations, etc."""

    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_exhaustive_user(
        self,
        username: str,
        *,
        email: str | None = None,
        is_admin: bool = False,
        is_staff: bool = False,
        is_superuser: bool = False,
    ) -> User:
        email = username if email is None else email
        user = self.create_user(
            email, username=username, is_staff=is_staff, is_superuser=is_superuser
        )
        UserOption.objects.create(user=user, key="timezone", value="Europe/Vienna")
        UserIP.objects.create(
            user=user,
            ip_address="127.0.0.2",
            first_seen=datetime(2012, 4, 5, 3, 29, 45, tzinfo=UTC),
            last_seen=datetime(2012, 4, 5, 3, 29, 45, tzinfo=UTC),
        )
        Authenticator.objects.create(user=user, type=1)

        if is_admin:
            self.add_user_permission(user, "users.admin")
            (role, _) = UserRole.objects.get_or_create(name="test-admin-role")
            UserRoleUser.objects.create(user=user, role=role)

        return user

    @assume_test_silo_mode(SiloMode.REGION)
    def create_exhaustive_organization(
        self,
        slug: str,
        owner: User,
        member: User,
        other_members: list[User] | None = None,
        pending_invites: dict[User, str] | None = None,
        # A dictionary of a user to the other users they invited
        accepted_invites: dict[User, list[User]] | None = None,
    ) -> Organization:
        org = self.create_organization(name=slug, owner=owner)
        owner_id: int = owner.id
        invited = self.create_member(organization=org, user=member, role="member")
        if other_members:
            for user in other_members:
                self.create_member(organization=org, user=user, role="member")
        if pending_invites:
            for inviter, email in pending_invites.items():
                OrganizationMember.objects.create(
                    organization_id=org.id,
                    role="member",
                    email=email,
                    inviter_id=inviter.id,
                    invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
                )
        if accepted_invites:
            for inviter, users in accepted_invites.items():
                for user in users:
                    self.create_member(
                        organization=org, user=user, role="member", inviter_id=inviter.id
                    )

        OrganizationOption.objects.create(
            organization=org, key="sentry:account-rate-limit", value=0
        )

        # Team
        team = self.create_team(name=f"test_team_in_{slug}", organization=org)
        self.create_team_membership(user=owner, team=team)
        OrganizationAccessRequest.objects.create(member=invited, team=team, requester_id=owner_id)

        # Project*
        project_template = ProjectTemplate.objects.create(name=f"template-{slug}", organization=org)
        ProjectTemplateOption.objects.create(
            project_template=project_template, key="mail:subject_prefix", value=f"[{slug}]"
        )

        # TODO (@saponifi3d): Add project template to project
        project = self.create_project(name=f"project-{slug}", teams=[team], organization=org)
        self.create_project_key(project)
        self.create_project_bookmark(project=project, user=owner)
        ProjectOwnership.objects.create(
            project=project, raw='{"hello":"hello"}', schema={"hello": "hello"}
        )
        ProjectRedirect.record(project, f"project_slug_in_{slug}")
        self.create_notification_action(organization=org, projects=[project])

        # Auth*
        self.create_exhaustive_organization_auth(owner, org, project)

        # Integration*
        org_integration = self.create_exhaustive_organization_integration(org)
        integration_id = org_integration.integration.id
        # Note: this model is deprecated, and can safely be removed from this test when it is
        # finally removed. Until then, it is included for completeness.
        ProjectIntegration.objects.create(
            project=project, integration_id=integration_id, config='{"hello":"hello"}'
        )

        # Rule*
        rule = self.create_project_rule(project=project, owner_user_id=owner_id)
        RuleActivity.objects.create(
            rule=rule, type=RuleActivityType.CREATED.value, user_id=owner_id
        )
        self.snooze_rule(user_id=owner_id, owner_id=owner_id, rule=rule)
        NeglectedRule.objects.create(
            rule=rule,
            organization=org,
            disable_date=timezone.now(),
            sent_initial_email_date=timezone.now(),
            sent_final_email_date=timezone.now(),
        )
        CustomDynamicSamplingRule.update_or_create(
            created_by_id=owner_id,
            condition={"op": "equals", "name": "environment", "value": "prod"},
            start=timezone.now(),
            end=timezone.now() + timedelta(hours=1),
            project_ids=[project.id],
            organization_id=org.id,
            num_samples=100,
            sample_rate=0.5,
            query="environment:prod event.type:transaction",
        )

        # Environment*
        self.create_environment(project=project)

        # Monitor
        Monitor.objects.create(
            organization_id=project.organization.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
            owner_user_id=owner_id,
        )

        # AlertRule*
        alert = self.create_alert_rule(
            organization=org,
            projects=[project],
            user=owner,
        )
        alert.user_id = owner_id
        alert.save()
        trigger = self.create_alert_rule_trigger(alert_rule=alert)
        assert alert.snuba_query is not None
        self.create_alert_rule_trigger_action(alert_rule_trigger=trigger)
        activated_alert = self.create_alert_rule(
            organization=org,
            projects=[project],
            monitor_type=AlertRuleMonitorTypeInt.ACTIVATED,
            activation_condition=AlertRuleActivationConditionType.RELEASE_CREATION,
        )
        self.create_alert_rule_activation(
            alert_rule=activated_alert,
            project=project,
            metric_value=100,
            activator="testing exhaustive",
            activation_condition=AlertRuleActivationConditionType.RELEASE_CREATION,
        )
        activated_trigger = self.create_alert_rule_trigger(alert_rule=activated_alert)
        self.create_alert_rule_trigger_action(alert_rule_trigger=activated_trigger)

        # Incident*
        incident = self.create_incident(org, [project])
        IncidentActivity.objects.create(
            incident=incident,
            type=1,
            comment=f"hello {slug}",
            user_id=owner_id,
        )
        IncidentSnapshot.objects.create(
            incident=incident,
            event_stats_snapshot=TimeSeriesSnapshot.objects.create(
                start=timezone.now() - timedelta(hours=24),
                end=timezone.now(),
                values=[[1.0, 2.0, 3.0], [1.5, 2.5, 3.5]],
                period=1,
            ),
            unique_users=1,
            total_events=1,
        )
        IncidentTrigger.objects.create(
            incident=incident,
            alert_rule_trigger=trigger,
            status=1,
        )

        # *Snapshot
        PendingIncidentSnapshot.objects.create(
            incident=incident, target_run_date=timezone.now() + timedelta(hours=4)
        )

        # Dashboard
        dashboard = Dashboard.objects.create(
            title=f"Dashboard 1 for {slug}",
            created_by_id=owner_id,
            organization=org,
        )
        DashboardFavoriteUser.objects.create(
            dashboard=dashboard,
            user_id=owner.id,
        )
        permissions = DashboardPermissions.objects.create(
            is_editable_by_everyone=True, dashboard=dashboard
        )
        permissions.teams_with_edit_access.set([team])
        widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            order=1,
            title=f"Test Widget for {slug}",
            display_type=0,
            widget_type=DashboardWidgetTypes.DISCOVER,
        )
        widget_query = DashboardWidgetQuery.objects.create(
            widget=widget, order=1, name=f"Test Query for {slug}"
        )
        DashboardWidgetQueryOnDemand.objects.create(
            dashboard_widget_query=widget_query,
            extraction_state=DashboardWidgetQueryOnDemand.OnDemandExtractionState.DISABLED_NOT_APPLICABLE,
            spec_hashes=[],
        )
        DashboardTombstone.objects.create(organization=org, slug=f"test-tombstone-in-{slug}")

        # *Search
        RecentSearch.objects.create(
            organization=org,
            user_id=owner_id,
            type=SearchType.ISSUE.value,
            query=f"some query for {slug}",
        )
        SavedSearch.objects.create(
            organization=org,
            name=f"Saved query for {slug}",
            query=f"saved query for {slug}",
            visibility=Visibility.ORGANIZATION,
            owner_id=owner_id,
        )

        # misc
        Counter.increment(project, 1)
        repo = self.create_repo(
            project=project,
            name="getsentry/getsentry",
            provider="integrations:github",
            integration_id=integration_id,
            url="https://github.com/getsentry/getsentry",
        )
        repo.external_id = "https://git.example.com:1234"
        repo.save()

        # Group*
        group = self.create_group(project=project)
        GroupSearchView.objects.create(
            name=f"View 1 for {slug}",
            user_id=owner_id,
            organization=org,
            query=f"some query for {slug}",
            query_sort="date",
            position=0,
        )
        Activity.objects.create(
            project=project,
            group=group,
            user_id=owner_id,
            type=1,
        )
        for group_model in (GroupAssignee, GroupBookmark, GroupSeen, GroupShare, GroupSubscription):
            group_model.objects.create(
                project=project,
                group=group,
                user_id=owner_id,
            )

        # DataSecrecyWaiver
        DataSecrecyWaiver.objects.create(
            organization=org,
            access_start=timezone.now(),
            access_end=timezone.now() + timedelta(days=1),
        )

        # Setup a test 'Issue Rule' and 'Automation'
        workflow = self.create_workflow(organization=org)
        detector = self.create_detector(project=project)
        self.create_detector_workflow(detector=detector, workflow=workflow)
        self.create_detector_state(detector=detector)

        notification_condition_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ANY,
            organization=org,
        )

        send_notification_action = self.create_action(type=Action.Type.NOTIFICATION, data="")
        self.create_data_condition_group_action(
            action=send_notification_action,
            condition_group=notification_condition_group,
        )

        # TODO @saponifi3d: Update comparison to be DetectorState.Critical
        data_condition = self.create_data_condition(
            condition="eq",
            comparison="critical",
            type="WorkflowCondition",
            condition_result="True",
            condition_group=notification_condition_group,
        )

        self.create_workflow_data_condition_group(
            workflow=workflow, condition_group=notification_condition_group
        )

        data_source = self.create_data_source(organization=org)

        self.create_data_source_detector(data_source, detector)
        detector_conditions = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ALL,
            organization=org,
        )

        # TODO @saponifi3d: Create or define trigger workflow action type
        trigger_workflows_action = self.create_action(type=Action.Type.WEBHOOK, data="")
        self.create_data_condition_group_action(
            action=trigger_workflows_action, condition_group=detector_conditions
        )
        self.create_data_condition(
            condition="eq",
            comparison="critical",
            type="DetectorCondition",
            condition_result="True",
            condition_group=detector_conditions,
        )
        detector.workflow_condition_group = detector_conditions

        AlertRuleDetector.objects.create(detector=detector, alert_rule=alert)
        AlertRuleWorkflow.objects.create(workflow=workflow, alert_rule=alert)
        AlertRuleTriggerDataCondition.objects.create(
            alert_rule_trigger=trigger, data_condition=data_condition
        )

        TempestCredentials.objects.create(
            project=project,
            created_by_id=owner_id,
            client_id="test_client_id",
            client_secret="test_client_secret",
            message="test_message",
            latest_fetched_item_id="test_latest_fetched_item_id",
        )

        return org

    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_exhaustive_organization_auth(self, owner: User, org: Organization, project: Project):
        ApiKey.objects.create(key=uuid4().hex, organization_id=org.id)
        auth_provider = AuthProvider.objects.create(organization_id=org.id, provider="sentry")
        AuthIdentity.objects.create(
            user=owner,
            auth_provider=auth_provider,
            ident=f"123456789{org.slug}",
            data={
                "key1": "value1",
                "key2": 42,
                "key3": [1, 2, 3],
                "key4": {"nested_key": "nested_value"},
            },
        )
        OrgAuthToken.objects.create(
            organization_id=org.id,
            created_by=owner,
            name=f"token 1 for {org.slug}",
            token_hashed=f"ABCDEF{org.slug}",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
            project_last_used_id=project.id,
        )

    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_exhaustive_organization_integration(self, org: Organization):
        integration = Integration.objects.create(
            provider="slack", name=f"Slack for {org.slug}", external_id=f"slack:{org.slug}"
        )
        return OrganizationIntegration.objects.create(
            organization_id=org.id, integration=integration, config='{"hello":"hello"}'
        )

    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_exhaustive_sentry_app(self, name: str, owner: User, org: Organization) -> SentryApp:
        # SentryApp*
        app = self.create_sentry_app(
            name=name,
            organization=org,
            overview="A sample description",
            webhook_url="https://example.com/sentry-app/webhook/",
            redirect_url="https://example.com/sentry-app/redirect/",
        )

        install = self.create_sentry_app_installation(slug=app.slug, organization=org, user=owner)
        updater = SentryAppUpdater(sentry_app=app)
        updater.schema = {"elements": [self.create_alert_rule_action_schema()]}
        updater.run(owner)

        # Api*
        ApiAuthorization.objects.create(application=app.application, user=owner)
        ApiToken.objects.create(
            application=app.application,
            user=owner,
            expires_at=None,
            name="create_exhaustive_sentry_app",
        )
        ApiGrant.objects.create(
            user=owner,
            application=app.application,
            expires_at="2022-01-01 11:11+00:00",
            redirect_uri="https://example.com",
            scope_list=["openid", "profile", "email"],
        )

        # ServiceHook
        self.create_service_hook(
            application_id=app.application.id,
            actor_id=app.proxy_user.id,
            installation_id=install.id,
            org=org,
        )

        # NotificationAction
        self.create_exhaustive_sentry_app_notification(app, org)

        return app

    @assume_test_silo_mode(SiloMode.REGION)
    def create_exhaustive_sentry_app_notification(self, app: SentryApp, org: Organization):
        project = Project.objects.filter(organization=org).first()
        self.create_notification_action(organization=org, sentry_app_id=app.id, projects=[project])

    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_exhaustive_global_configs(self, owner: User):
        self.create_exhaustive_api_keys_for_user(owner)
        self.create_exhaustive_global_configs_regional()
        ControlOption.objects.create(key="bar", value="b")

    @assume_test_silo_mode(SiloMode.REGION)
    def create_exhaustive_global_configs_regional(self):
        _, public_key = generate_key_pair()
        relay = str(uuid4())
        Relay.objects.create(relay_id=relay, public_key=str(public_key), is_internal=True)
        RelayUsage.objects.create(relay_id=relay, version="0.0.1", public_key=public_key)
        Option.objects.create(key="foo", value="a")

    def create_exhaustive_instance(self, *, is_superadmin: bool = False):
        """
        Takes an empty Sentry instance's database, and populates it with an "exhaustive" version of
        every model. The end result is two users, in one organization, with one full set of
        extensions, and all global flags set.
        """

        superadmin = self.create_exhaustive_user(
            "superadmin", is_admin=is_superadmin, is_superuser=is_superadmin, is_staff=is_superadmin
        )
        owner = self.create_exhaustive_user("owner")
        member = self.create_exhaustive_user("member")
        org = self.create_exhaustive_organization(
            "test-org",
            owner,
            member,
            pending_invites={
                superadmin: "invited-by-superadmin-not-in-org@example.com",
                owner: "invited-by-org-owner@example.com",
                member: "invited-by-org-member@example.com",
            },
            accepted_invites={
                superadmin: [self.create_exhaustive_user("added-by-superadmin-not-in-org")],
                owner: [self.create_exhaustive_user("added-by-org-owner")],
                member: [self.create_exhaustive_user("added-by-org-member")],
            },
        )
        self.create_exhaustive_sentry_app("test app", owner, org)
        self.create_exhaustive_global_configs(owner)

    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_exhaustive_api_keys_for_user(self, user: User):
        ApiAuthorization.objects.create(user=user)
        ApiToken.objects.create(
            user=user,
            expires_at=None,
            name=f"create_exhaustive_global_configs_for_{user.name}",
            token_type=AuthTokenType.USER,
        )

    def import_export_then_validate(self, out_name, *, reset_pks: bool = True) -> Any:
        return import_export_then_validate(out_name, reset_pks=reset_pks)

    @cached_property
    def _json_of_exhaustive_user_with_maximum_privileges(self) -> Any:
        with open(get_fixture_path("backup", "user-with-maximum-privileges.json")) as backup_file:
            return json.load(backup_file)

    def json_of_exhaustive_user_with_maximum_privileges(self) -> Any:
        return deepcopy(self._json_of_exhaustive_user_with_maximum_privileges)

    @cached_property
    def _json_of_exhaustive_user_with_minimum_privileges(self) -> Any:
        with open(get_fixture_path("backup", "user-with-minimum-privileges.json")) as backup_file:
            return json.load(backup_file)

    def json_of_exhaustive_user_with_minimum_privileges(self) -> Any:
        return deepcopy(self._json_of_exhaustive_user_with_minimum_privileges)

    @cached_property
    def _json_of_exhaustive_user_with_roles_no_superadmin(self) -> Any:
        with open(get_fixture_path("backup", "user-with-roles-no-superadmin.json")) as backup_file:
            return json.load(backup_file)

    def json_of_exhaustive_user_with_roles_no_superadmin(self) -> Any:
        return deepcopy(self._json_of_exhaustive_user_with_roles_no_superadmin)

    @cached_property
    def _json_of_exhaustive_user_with_superadmin_no_roles(self) -> Any:
        with open(get_fixture_path("backup", "user-with-superadmin-no-roles.json")) as backup_file:
            return json.load(backup_file)

    def json_of_exhaustive_user_with_superadmin_no_roles(self) -> Any:
        return deepcopy(self._json_of_exhaustive_user_with_superadmin_no_roles)

    @staticmethod
    def sort_in_memory_json(json_data: Any) -> Any:
        """
        Helper function that takes an unordered set of JSON models and sorts them first in
        dependency order, and then, within each model, by ascending pk number.
        """

        def sort_by_model_then_pk(a: Any, b: Any) -> int:
            sorted_deps = sorted_dependencies()
            a_model = get_model(NormalizedModelName(a["model"]))
            b_model = get_model(NormalizedModelName(b["model"]))
            model_diff = sorted_deps.index(a_model) - sorted_deps.index(b_model)  # type: ignore[arg-type]
            if model_diff != 0:
                return model_diff

            return a["pk"] - b["pk"]

        return sorted(
            json_data,
            key=cmp_to_key(sort_by_model_then_pk),
        )

    def generate_tmp_users_json(self) -> Any:
        """
        Generates an in-memory JSON array of users with different combinations of admin privileges.
        """

        # A user with the maximal amount of "evil" settings.
        max_user = deepcopy(self.json_of_exhaustive_user_with_maximum_privileges())

        # A user with no "evil" settings.
        min_user = deepcopy(self.json_of_exhaustive_user_with_minimum_privileges())

        # A copy of the `min_user`, but with a maximal `UserPermissions` attached.
        roles_user = deepcopy(self.json_of_exhaustive_user_with_roles_no_superadmin())

        # A copy of the `min_user`, but with all of the "evil" flags set to `True`.
        superadmin_user = deepcopy(self.json_of_exhaustive_user_with_superadmin_no_roles())

        return self.sort_in_memory_json(max_user + min_user + roles_user + superadmin_user)

    def generate_tmp_users_json_file(self, tmp_path: Path) -> Any:
        """
        Generates a file filled with users with different combinations of admin privileges.
        """

        data = self.generate_tmp_users_json()
        with open(tmp_path, "w+") as tmp_file:
            json.dump(data, tmp_file)


class BackupTestCase(TestCase, ExhaustiveFixtures):
    """
    Instruments a database state that includes an instance of every Sentry model with every field
    set to a non-default, non-null value. This is useful for exhaustive conformance testing.
    """


class BackupTransactionTestCase(TransactionTestCase, ExhaustiveFixtures):
    """
    Instruments a database state that includes an instance of every Sentry model with every field
    set to a non-default, non-null value. This is useful for exhaustive conformance testing. Unlike `BackupTestCase`, this completely resets the database between each test, which can be an expensive operation.
    """
