from django.core import mail

from sentry.eventstream.types import EventStreamEventType
from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.mail.actions import NotifyEmailAction
from sentry.mail.forms.notify_email import NotifyEmailForm
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.projectownership import ProjectOwnership
from sentry.models.rule import Rule
from sentry.services.eventstore.models import GroupEvent
from sentry.tasks.post_process import post_process_group
from sentry.testutils.cases import PerformanceIssueTestCase, RuleTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.eventprocessing import write_event_to_cache
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType
from sentry.workflow_engine.typings.notification_action import (
    ActionTarget,
    ActionTargetType,
    FallthroughChoiceType,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

pytestmark = requires_snuba


class NotifyEmailFormTest(TestCase):
    TARGET_TYPE_KEY = "targetType"
    FALLTHROUGH_CHOICE_KEY = "fallthroughChoice"
    TARGET_IDENTIFIER_KEY = "targetIdentifier"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(email="foo@example.com", is_active=True)
        self.user2 = self.create_user(email="baz@example.com", is_active=True)
        self.inactive_user = self.create_user(email="totallynotabot@149.com", is_active=False)

        organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=organization)
        self.team_not_in_project = self.create_team(organization=organization)

        self.project = self.create_project(name="Test", teams=[self.team])
        OrganizationMemberTeam.objects.create(
            organizationmember=OrganizationMember.objects.get(
                user_id=self.user.id, organization=organization
            ),
            team=self.team,
        )
        self.create_member(user_id=self.user2.id, organization=organization, teams=[self.team])
        self.create_member(
            user_id=self.inactive_user.id,
            organization=organization,
            teams=[self.team, self.team_not_in_project],
        )

    def form_from_json(self, json):
        return NotifyEmailForm(self.project, json)

    def form_from_values(self, target_type_value, target_id=None, fallthroughChoice=None):
        json = {self.TARGET_TYPE_KEY: target_type_value, "fallthroughChoice": fallthroughChoice}
        if target_id:
            json[self.TARGET_IDENTIFIER_KEY] = target_id
        return self.form_from_json(json)

    def test_validate_empty_fail(self) -> None:
        form = self.form_from_json({})
        assert not form.is_valid()

    def test_validate_none_fail(self) -> None:
        form = self.form_from_json(None)
        assert not form.is_valid()

    def test_validate_malformed_json_fail(self) -> None:
        form = self.form_from_json({"notTheRightK3yName": ActionTargetType.ISSUE_OWNERS.value})
        assert not form.is_valid()

    def test_validate_invalid_target_type_fail(self) -> None:
        form = self.form_from_values("TheLegend27")
        assert not form.is_valid()

    def test_validate_issue_owners(self) -> None:
        form = self.form_from_values(ActionTargetType.ISSUE_OWNERS.value)
        assert form.is_valid()

    def test_validate_fallthrough_choice(self) -> None:
        form = self.form_from_values(
            ActionTargetType.ISSUE_OWNERS.value,
            fallthroughChoice=FallthroughChoiceType.NO_ONE.value,
        )
        assert form.is_valid()

        form = self.form_from_values(
            ActionTargetType.ISSUE_OWNERS.value,
            fallthroughChoice=FallthroughChoiceType.ALL_MEMBERS.value,
        )
        assert form.is_valid()

    def test_validate_invalid_fallthrough_choice(self) -> None:
        # FallthroughChoice is only set for ActionTargetType.ISSUE_OWNERS
        form = self.form_from_values(
            ActionTargetType.TEAM.value,
            fallthroughChoice=FallthroughChoiceType.ACTIVE_MEMBERS.value,
        )
        assert not form.is_valid()

    def test_validate_team(self) -> None:
        form = self.form_from_values(ActionTargetType.TEAM.value, self.team.id)
        assert form.is_valid()

    def test_validate_team_not_in_project_fail(self) -> None:
        form = self.form_from_values(ActionTargetType.TEAM.value, self.team_not_in_project.id)
        assert not form.is_valid()

    def test_validate_user(self) -> None:
        for u in [self.user, self.user2]:
            form = self.form_from_values(ActionTargetType.MEMBER.value, u.id)
            assert form.is_valid()

    def test_validate_inactive_user_fail(self) -> None:
        form = self.form_from_values(ActionTargetType.MEMBER.value, self.inactive_user)
        assert not form.is_valid()

    def test_none_target_identifier(self) -> None:
        json = {self.TARGET_TYPE_KEY: ActionTargetType.ISSUE_OWNERS.value}
        json[self.TARGET_IDENTIFIER_KEY] = "None"
        form = self.form_from_json(json)
        assert form.is_valid()


class NotifyEmailTest(RuleTestCase, PerformanceIssueTestCase, BaseWorkflowTest):
    rule_cls = NotifyEmailAction

    def setUp(self):
        self.one_min_ago = before_now(minutes=1).isoformat()
        self.event = self.store_event(
            data={
                "message": "hello",
                "exception": {"type": "Foo", "value": "uh oh"},
                "level": "error",
                "timestamp": self.one_min_ago,
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        (
            self.error_workflow,
            self.error_detector,
            self.detector_workflow_error,
            self.condition_group,
        ) = self.create_detector_and_workflow(
            name_prefix="error",
            workflow_triggers=self.create_data_condition_group(),
            detector_type=ErrorGroupType.slug,
        )
        self.create_workflow_data_condition_group(
            workflow=self.error_workflow, condition_group=self.condition_group
        )
        self.issue_owners_action_config = {
            "target_type": ActionTarget.ISSUE_OWNERS.value,
            "target_display": None,
            "target_identifier": None,
        }
        self.issue_stream_detector = self.create_detector(
            project=self.project,
            type=IssueStreamGroupType.slug,
        )

    @with_feature("organizations:workflow-engine-single-process-workflows")
    @override_options({"workflow_engine.issue_alert.group.type_id.rollout": [1]})
    def test_full_integration(self) -> None:
        action_config = {
            "target_type": ActionTarget.USER.value,
            "target_display": None,
            "target_identifier": str(self.user.id),
        }
        action = self.create_action(config=action_config, type="email", data={})
        self.create_data_condition_group_action(condition_group=self.condition_group, action=action)

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(self.event),
                group_id=self.event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(mail.outbox) == 1
        sent = mail.outbox[0]
        assert sent.to == [self.user.email]
        assert "uh oh" in sent.subject

    @with_feature("organizations:workflow-engine-single-process-workflows")
    @override_options({"workflow_engine.issue_alert.group.type_id.rollout": [1]})
    def test_full_integration_all_members_fallthrough(self) -> None:
        action_data = {"fallthrough_type": FallthroughChoiceType.ALL_MEMBERS.value}
        action = self.create_action(
            config=self.issue_owners_action_config, type="email", data=action_data
        )
        self.create_data_condition_group_action(condition_group=self.condition_group, action=action)

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(self.event),
                group_id=self.event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(mail.outbox) == 1
        sent = mail.outbox[0]
        assert sent.to == [self.user.email]
        assert "uh oh" in sent.subject

    @with_feature("organizations:workflow-engine-single-process-workflows")
    @override_options({"workflow_engine.issue_alert.group.type_id.rollout": [1]})
    def test_full_integration_noone_fallthrough(self) -> None:
        action_data = {"fallthrough_type": FallthroughChoiceType.NO_ONE.value}
        action = self.create_action(
            config=self.issue_owners_action_config, type="email", data=action_data
        )
        self.create_data_condition_group_action(condition_group=self.condition_group, action=action)

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(self.event),
                group_id=self.event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(mail.outbox) == 0

    @with_feature("organizations:workflow-engine-single-process-workflows")
    @override_options({"workflow_engine.issue_alert.group.type_id.rollout": [1]})
    def test_full_integration_fallthrough_not_provided(self) -> None:
        action = self.create_action(config=self.issue_owners_action_config, type="email", data={})
        self.create_data_condition_group_action(condition_group=self.condition_group, action=action)

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(self.event),
                group_id=self.event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        # See that the ActiveMembers default results in notifications still being sent
        assert len(mail.outbox) == 1
        sent = mail.outbox[0]
        assert sent.to == [self.user.email]
        assert "uh oh" in sent.subject

    @with_feature("organizations:workflow-engine-single-process-workflows")
    @override_options({"workflow_engine.issue_alert.group.type_id.rollout": [1]})
    def test_hack_mail_workflow(self) -> None:
        colleen_workflow = self.create_user(email="colleen@workflow.com", is_active=True)
        michelle_workflow = self.create_user(email="michelle@workflow.com", is_active=True)
        team_workflow = self.create_team(
            organization=self.organization, members=[colleen_workflow, michelle_workflow]
        )
        self.project.add_team(team_workflow)
        action_config = {
            "target_type": ActionTarget.USER.value,
            "target_display": None,
            "target_identifier": str(self.user.id),
        }
        inject_workflow = {
            "target_type": ActionTarget.TEAM.value,
            "target_display": None,
            "target_identifier": str(team_workflow.id),
        }
        action = self.create_action(config=action_config, type="email", data={})
        self.create_data_condition_group_action(condition_group=self.condition_group, action=action)

        action2 = self.create_action(config=inject_workflow, type="email", data={})
        self.create_data_condition_group_action(
            condition_group=self.condition_group, action=action2
        )

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(self.event),
                group_id=self.event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(mail.outbox) == 3
        sent_out_to = sorted(x for out in mail.outbox for x in out.to)
        assert sent_out_to == sorted(
            [self.user.email, colleen_workflow.email, michelle_workflow.email]
        )
        for x in [out.subject for out in mail.outbox]:
            assert "uh oh" in x


class NotifyLegacyEmailTest(NotifyEmailTest):
    def setUp(self):
        super().setUp()
        self.condition_data = {
            "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"
        }

    def test_legacy_simple(self) -> None:
        event = self.get_event()
        rule = self.get_rule(data={"targetType": ActionTargetType.ISSUE_OWNERS.value})
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        results = list(rule.after(event=event))
        assert len(results) == 1

    def test_legacy_full_integration(self) -> None:
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": ActionTargetType.MEMBER.value,
            "targetIdentifier": str(self.user.id),
        }
        Rule.objects.filter(project=self.event.project).delete()
        rule = self.create_project_rule(project=self.event.project, action_data=[action_data])
        rule.data["conditions"] = [self.condition_data]
        rule.save()

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(self.event),
                group_id=self.event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(mail.outbox) == 1
        sent = mail.outbox[0]
        assert sent.to == [self.user.email]
        assert "uh oh" in sent.subject

    def test_legacy_full_integration_fallthrough(self) -> None:
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": ActionTargetType.ISSUE_OWNERS.value,
            "fallthrough_type": FallthroughChoiceType.ALL_MEMBERS.value,
        }
        Rule.objects.filter(project=self.event.project).delete()
        rule = self.create_project_rule(project=self.event.project, action_data=[action_data])
        rule.data["conditions"] = [self.condition_data]
        rule.save()

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(self.event),
                group_id=self.event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(mail.outbox) == 1
        sent = mail.outbox[0]
        assert sent.to == [self.user.email]
        assert "uh oh" in sent.subject

    def test_legacy_full_integration_noone_fallthrough(self) -> None:
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": ActionTargetType.ISSUE_OWNERS.value,
            "fallthrough_type": FallthroughChoiceType.NO_ONE.value,
        }
        Rule.objects.filter(project=self.event.project).delete()
        rule = self.create_project_rule(project=self.event.project, action_data=[action_data])
        rule.data["conditions"] = [self.condition_data]
        rule.save()

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(self.event),
                group_id=self.event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(mail.outbox) == 0

    def test_legacy_full_integration_fallthrough_not_provided(self) -> None:
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": ActionTargetType.ISSUE_OWNERS.value,
        }
        Rule.objects.filter(project=self.event.project).delete()
        rule = self.create_project_rule(project=self.event.project, action_data=[action_data])
        rule.data["conditions"] = [self.condition_data]
        rule.save()

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(self.event),
                group_id=self.event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        # See that the ActiveMembers default results in notifications still being sent
        assert len(mail.outbox) == 1
        sent = mail.outbox[0]
        assert sent.to == [self.user.email]
        assert "uh oh" in sent.subject

    def test_legacy_full_integration_performance(self) -> None:
        event = self.create_performance_issue()
        assert isinstance(event, GroupEvent)
        assert event.group is not None

        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": ActionTargetType.MEMBER.value,
            "targetIdentifier": str(self.user.id),
        }
        Rule.objects.filter(project=event.project).delete()
        rule = self.create_project_rule(project=event.project, action_data=[action_data])
        rule.data["conditions"] = [self.condition_data]
        rule.save()

        with (
            self.tasks(),
            self.feature(PerformanceNPlusOneGroupType.build_post_process_group_feature_name()),
        ):
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                occurrence_id=event.occurrence_id,
                project_id=event.group.project_id,
                group_id=event.group_id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(mail.outbox) == 1
        sent = mail.outbox[0]
        assert sent.to == [self.user.email]
        assert "N+1 Query" in sent.subject

    def test_legacy_hack_mail_workflow(self) -> None:
        gil_workflow = self.create_user(email="gilbert@workflow.com", is_active=True)
        dan_workflow = self.create_user(email="dan@workflow.com", is_active=True)
        team_workflow = self.create_team(
            organization=self.organization, members=[gil_workflow, dan_workflow]
        )
        self.project.add_team(team_workflow)
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": ActionTargetType.MEMBER.value,
            "targetIdentifier": str(self.user.id),
        }
        inject_workflow = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": ActionTargetType.TEAM.value,
            "targetIdentifier": str(team_workflow.id),
        }
        Rule.objects.filter(project=self.event.project).delete()
        rule = self.create_project_rule(
            project=self.event.project, action_data=[action_data, inject_workflow]
        )
        rule.data["conditions"] = [self.condition_data]
        rule.save()

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(self.event),
                group_id=self.event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(mail.outbox) == 3
        sent_out_to = sorted(x for out in mail.outbox for x in out.to)
        assert sent_out_to == sorted([self.user.email, gil_workflow.email, dan_workflow.email])
        for x in [out.subject for out in mail.outbox]:
            assert "uh oh" in x

    def test_legacy_render_label_fallback_none(self) -> None:
        # Check that the label defaults to ActiveMembers
        rule = self.get_rule(data={"targetType": ActionTargetType.ISSUE_OWNERS.value})
        assert (
            rule.render_label()
            == "Send a notification to IssueOwners and if none can be found then send a notification to ActiveMembers"
        )

        rule = self.get_rule(
            data={
                "targetType": ActionTargetType.ISSUE_OWNERS.value,
                "fallthroughType": FallthroughChoiceType.ALL_MEMBERS.value,
            }
        )
        assert (
            rule.render_label()
            == "Send a notification to IssueOwners and if none can be found then send a notification to AllMembers"
        )
