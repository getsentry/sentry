from typing import Any

import pytest
from django.utils.functional import cached_property

from sentry.incidents.models import IncidentActivityType
from sentry.models import (
    Activity,
    Integration,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
)
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import before_now, iso_format


# XXX(dcramer): this is a compatibility layer to transition to pytest-based fixtures
# all of the memoized fixtures are copypasta due to our inability to use pytest fixtures
# on a per-class method basis
class Fixtures:
    @cached_property
    def session(self):
        return Factories.create_session()

    @cached_property
    def projectkey(self):
        return self.create_project_key(project=self.project)

    @cached_property
    def user(self):
        return self.create_user("admin@localhost", is_superuser=True)

    @cached_property
    def organization(self):
        # XXX(dcramer): ensure that your org slug doesnt match your team slug
        # and the same for your project slug
        return self.create_organization(name="baz", slug="baz", owner=self.user)

    @cached_property
    def team(self):
        team = self.create_team(organization=self.organization, name="foo", slug="foo")
        # XXX: handle legacy team fixture
        queryset = OrganizationMember.objects.filter(organization=self.organization)
        for om in queryset:
            OrganizationMemberTeam.objects.create(team=team, organizationmember=om, is_active=True)
        return team

    @cached_property
    def project(self):
        return self.create_project(
            name="Bar", slug="bar", teams=[self.team], fire_project_created=True
        )

    @cached_property
    def release(self):
        return self.create_release(project=self.project, version="foo-1.0")

    @cached_property
    def environment(self):
        return self.create_environment(name="development", project=self.project)

    @cached_property
    def group(self):
        # こんにちは konichiwa
        return self.create_group(message="\u3053\u3093\u306b\u3061\u306f")

    @cached_property
    def event(self):
        return self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "\u3053\u3093\u306b\u3061\u306f",
                "timestamp": iso_format(before_now(seconds=1)),
            },
            project_id=self.project.id,
        )

    @cached_property
    def activity(self):
        return Activity.objects.create(
            group=self.group, project=self.project, type=Activity.NOTE, user=self.user, data={}
        )

    def create_organization(self, *args, **kwargs):
        return Factories.create_organization(*args, **kwargs)

    def create_member(self, *args, **kwargs):
        return Factories.create_member(*args, **kwargs)

    def create_team_membership(self, *args, **kwargs):
        return Factories.create_team_membership(*args, **kwargs)

    def create_team(self, organization=None, **kwargs):
        if organization is None:
            organization = self.organization

        return Factories.create_team(organization=organization, **kwargs)

    def create_environment(self, project=None, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_environment(project=project, **kwargs)

    def create_project(self, **kwargs):
        kwargs.setdefault("teams", [self.team])
        return Factories.create_project(**kwargs)

    def create_project_bookmark(self, project=None, *args, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_project_bookmark(project=project, *args, **kwargs)

    def create_project_key(self, project=None, *args, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_project_key(project=project, *args, **kwargs)

    def create_project_rule(
        self, project=None, action_match=None, condition_match=None, *args, **kwargs
    ):
        if project is None:
            project = self.project
        return Factories.create_project_rule(
            project=project,
            action_match=action_match,
            condition_match=condition_match,
            *args,
            **kwargs,
        )

    def create_slack_project_rule(
        self, project=None, integration_id=None, channel_id=None, channel_name=None, *args, **kwargs
    ):
        if project is None:
            project = self.project
        return Factories.create_slack_project_rule(
            project,
            integration_id=integration_id,
            channel_id=channel_id,
            channel_name=channel_name,
            *args,
            **kwargs,
        )

    def create_release(self, project=None, user=None, *args, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_release(project=project, user=user, *args, **kwargs)

    def create_release_file(self, release_id=None, file=None, name=None, dist_id=None):
        if release_id is None:
            release_id = self.release.id
        return Factories.create_release_file(release_id, file, name, dist_id)

    def create_artifact_bundle(self, org=None, release=None, *args, **kwargs):
        if org is None:
            org = self.organization.slug
        if release is None:
            release = self.release.version
        return Factories.create_artifact_bundle(org, release, *args, **kwargs)

    def create_release_archive(self, org=None, release=None, *args, **kwargs):
        if org is None:
            org = self.organization.slug
        if release is None:
            release = self.release.version
        return Factories.create_release_archive(org, release, *args, **kwargs)

    def create_code_mapping(self, project=None, repo=None, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_code_mapping(project, repo, **kwargs)

    def create_repo(self, project=None, *args, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_repo(project=project, *args, **kwargs)

    def create_commit(self, *args, **kwargs):
        return Factories.create_commit(*args, **kwargs)

    def create_commit_author(self, *args, **kwargs):
        return Factories.create_commit_author(*args, **kwargs)

    def create_commit_file_change(self, *args, **kwargs):
        return Factories.create_commit_file_change(*args, **kwargs)

    def create_user(self, *args, **kwargs):
        return Factories.create_user(*args, **kwargs)

    def create_useremail(self, *args, **kwargs):
        return Factories.create_useremail(*args, **kwargs)

    def store_event(self, *args, **kwargs):
        return Factories.store_event(*args, **kwargs)

    def create_group(self, project=None, *args, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_group(project=project, *args, **kwargs)

    def create_file(self, **kwargs):
        return Factories.create_file(**kwargs)

    def create_file_from_path(self, *args, **kwargs):
        return Factories.create_file_from_path(*args, **kwargs)

    def create_event_attachment(self, event=None, *args, **kwargs):
        if event is None:
            event = self.event
        return Factories.create_event_attachment(event=event, *args, **kwargs)

    def create_dif_file(self, project=None, *args, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_dif_file(project=project, *args, **kwargs)

    def create_dif_from_path(self, project=None, *args, **kwargs):
        if project is None:
            project = self.project
        return Factories.create_dif_from_path(project=project, *args, **kwargs)

    def add_user_permission(self, *args, **kwargs):
        return Factories.add_user_permission(*args, **kwargs)

    def create_sentry_app(self, *args, **kwargs):
        return Factories.create_sentry_app(*args, **kwargs)

    def create_internal_integration(self, *args, **kwargs):
        return Factories.create_internal_integration(*args, **kwargs)

    def create_internal_integration_token(self, *args, **kwargs):
        return Factories.create_internal_integration_token(*args, **kwargs)

    def create_sentry_app_installation(self, *args, **kwargs):
        return Factories.create_sentry_app_installation(*args, **kwargs)

    def create_issue_link_schema(self, *args, **kwargs):
        return Factories.create_issue_link_schema(*args, **kwargs)

    def create_alert_rule_action_schema(self, *args, **kwargs):
        return Factories.create_alert_rule_action_schema(*args, **kwargs)

    def create_sentry_app_feature(self, *args, **kwargs):
        return Factories.create_sentry_app_feature(*args, **kwargs)

    def create_service_hook(self, *args, **kwargs):
        return Factories.create_service_hook(*args, **kwargs)

    def create_userreport(self, *args, **kwargs):
        return Factories.create_userreport(*args, **kwargs)

    def create_platform_external_issue(self, *args, **kwargs):
        return Factories.create_platform_external_issue(*args, **kwargs)

    def create_integration_external_issue(self, *args, **kwargs):
        return Factories.create_integration_external_issue(*args, **kwargs)

    def create_incident(self, organization=None, projects=None, *args, **kwargs):
        if not organization:
            organization = self.organization
        if projects is None:
            projects = [self.project]

        return Factories.create_incident(
            organization=organization, projects=projects, *args, **kwargs
        )

    def create_incident_activity(self, incident, *args, **kwargs):
        return Factories.create_incident_activity(incident=incident, *args, **kwargs)

    def create_incident_comment(self, incident, *args, **kwargs):
        return self.create_incident_activity(
            incident, type=IncidentActivityType.COMMENT.value, *args, **kwargs
        )

    def create_alert_rule(self, organization=None, projects=None, *args, **kwargs):
        if not organization:
            organization = self.organization
        if projects is None:
            projects = [self.project]
        return Factories.create_alert_rule(organization, projects, *args, **kwargs)

    def create_alert_rule_trigger(self, alert_rule=None, *args, **kwargs):
        if not alert_rule:
            alert_rule = self.create_alert_rule()
        return Factories.create_alert_rule_trigger(alert_rule, *args, **kwargs)

    def create_alert_rule_trigger_action(
        self,
        alert_rule_trigger=None,
        target_identifier=None,
        triggered_for_incident=None,
        *args,
        **kwargs,
    ):
        if not alert_rule_trigger:
            alert_rule_trigger = self.create_alert_rule_trigger()

        if not target_identifier:
            target_identifier = str(self.user.id)

        if triggered_for_incident is not None:
            Factories.create_incident_trigger(triggered_for_incident, alert_rule_trigger)

        return Factories.create_alert_rule_trigger_action(
            alert_rule_trigger, target_identifier=target_identifier, **kwargs
        )

    def create_external_user(self, user=None, organization=None, integration=None, **kwargs):
        if not user:
            user = self.user
        if not organization:
            organization = self.organization  # Force creation.
        if not integration:
            integration = Integration.objects.create(
                provider="github", name="GitHub", external_id="github:1"
            )
            integration.add_organization(self.organization, self.user)
        return Factories.create_external_user(
            user=user, organization=organization, integration_id=integration.id, **kwargs
        )

    def create_external_team(self, team=None, integration=None, **kwargs):
        if not team:
            team = self.team
        if not integration:
            integration = Integration.objects.create(
                provider="github", name="GitHub", external_id="github:1"
            )
            integration.add_organization(self.organization, self.user)
        return Factories.create_external_team(
            team=team, organization=team.organization, integration_id=integration.id, **kwargs
        )

    def create_codeowners(self, project=None, code_mapping=None, **kwargs):
        if not project:
            project = self.project
        if not code_mapping:
            self.repo = self.create_repo(self.project)
            code_mapping = self.create_code_mapping(self.project, self.repo)

        return Factories.create_codeowners(project=project, code_mapping=code_mapping, **kwargs)

    def create_slack_integration(
        self,
        organization: "Organization",
        external_id: str = "TXXXXXXX1",
        **kwargs: Any,
    ):
        integration = Factories.create_slack_integration(
            organization=organization, external_id=external_id, **kwargs
        )
        idp = Factories.create_identity_provider(integration=integration)
        Factories.create_identity(organization.get_default_owner(), idp, "UXXXXXXX1")

        return integration

    def create_identity(self, *args, **kwargs):
        return Factories.create_identity(*args, **kwargs)

    def create_identity_provider(self, *args, **kwargs):
        return Factories.create_identity_provider(*args, **kwargs)

    @pytest.fixture(autouse=True)
    def _init_insta_snapshot(self, insta_snapshot):
        self.insta_snapshot = insta_snapshot
