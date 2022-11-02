from unittest import mock

from django.core import mail

from sentry.mail.actions import NotifyEmailAction, NotifyEmailForm
from sentry.models import OrganizationMember, OrganizationMemberTeam, ProjectOwnership, Rule
from sentry.notifications.types import ActionTargetType
from sentry.tasks.post_process import post_process_group
from sentry.testutils import TestCase
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.eventprocessing import write_event_to_cache
from sentry.types.issues import GroupType
from sentry.utils.samples import load_data


class NotifyEmailFormTest(TestCase):
    TARGET_TYPE_KEY = "targetType"
    TARGET_IDENTIFIER_KEY = "targetIdentifier"

    def setUp(self):
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
                user=self.user, organization=organization
            ),
            team=self.team,
        )
        self.create_member(user=self.user2, organization=organization, teams=[self.team])
        self.create_member(
            user=self.inactive_user,
            organization=organization,
            teams=[self.team, self.team_not_in_project],
        )

    def form_from_json(self, json):
        return NotifyEmailForm(self.project, json)

    def form_from_values(self, target_type_value, target_id=None):
        json = {self.TARGET_TYPE_KEY: target_type_value}
        if target_id:
            json[self.TARGET_IDENTIFIER_KEY] = target_id
        return self.form_from_json(json)

    def test_validate_empty_fail(self):
        form = self.form_from_json({})
        assert not form.is_valid()

    def test_validate_none_fail(self):
        form = self.form_from_json(None)
        assert not form.is_valid()

    def test_validate_malformed_json_fail(self):
        form = self.form_from_json({"notTheRightK3yName": ActionTargetType.ISSUE_OWNERS.value})
        assert not form.is_valid()

    def test_validate_invalid_target_type_fail(self):
        form = self.form_from_values("TheLegend27")
        assert not form.is_valid()

    def test_validate_issue_owners(self):
        form = self.form_from_values(ActionTargetType.ISSUE_OWNERS.value)
        assert form.is_valid()

    def test_validate_team(self):
        form = self.form_from_values(ActionTargetType.TEAM.value, self.team.id)
        assert form.is_valid()

    def test_validate_team_not_in_project_fail(self):
        form = self.form_from_values(ActionTargetType.TEAM.value, self.team_not_in_project.id)
        assert not form.is_valid()

    def test_validate_user(self):
        for u in [self.user, self.user2]:
            form = self.form_from_values(ActionTargetType.MEMBER.value, u.id)
            assert form.is_valid()

    def test_validate_inactive_user_fail(self):
        form = self.form_from_values(ActionTargetType.MEMBER.value, self.inactive_user)
        assert not form.is_valid()

    def test_none_target_identifier(self):
        json = {self.TARGET_TYPE_KEY: ActionTargetType.ISSUE_OWNERS.value}
        json[self.TARGET_IDENTIFIER_KEY] = "None"
        form = self.form_from_json(json)
        assert form.is_valid()


class NotifyEmailTest(RuleTestCase):
    rule_cls = NotifyEmailAction

    def test_simple(self):
        event = self.get_event()
        rule = self.get_rule(data={"targetType": "IssueOwners"})
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        results = list(rule.after(event=event, state=self.get_state()))
        assert len(results) == 1

    def test_full_integration(self):
        one_min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={
                "message": "hello",
                "exception": {"type": "Foo", "value": "uh oh"},
                "level": "error",
                "timestamp": one_min_ago,
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "Member",
            "targetIdentifier": str(self.user.id),
        }
        condition_data = {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}

        Rule.objects.filter(project=event.project).delete()
        Rule.objects.create(
            project=event.project, data={"conditions": [condition_data], "actions": [action_data]}
        )

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
            )

        assert len(mail.outbox) == 1
        sent = mail.outbox[0]
        assert sent.to == [self.user.email]
        assert "uh oh" in sent.subject

    @with_feature("organizations:performance-issues-post-process-group")
    def test_full_integration_performance(self):
        event_data = load_data(
            "transaction",
            fingerprint=[f"{GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES.value}-group1"],
            timestamp=before_now(minutes=1),
        )
        event = self.store_event(data=event_data, project_id=self.project.id)
        event = event.for_group(event.groups[0])

        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "Member",
            "targetIdentifier": str(self.user.id),
        }
        condition_data = {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}

        Rule.objects.filter(project=event.project).delete()
        Rule.objects.create(
            project=event.project, data={"conditions": [condition_data], "actions": [action_data]}
        )

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_states=[
                    {
                        "id": event.group_id,
                        "is_new": True,
                        "is_regression": False,
                        "is_new_group_environment": False,
                    }
                ],
            )

        assert len(mail.outbox) == 1
        sent = mail.outbox[0]
        assert sent.to == [self.user.email]
        assert "N+1 Query" in sent.subject

    # XXX(gilbert): remove this later one
    @mock.patch("sentry.mail.actions.determine_eligible_recipients")
    def test_release_note_target_type(self, mock_eligible_recipients):
        mock_eligible_recipients.return_value = [self.user]
        event = self.get_event()
        rule = self.get_rule(data={"targetType": ActionTargetType.RELEASE_MEMBERS.value})

        results = list(rule.after(event=event, state=self.get_state()))
        assert len(results) == 1

    def test_hack_mail_workflow(self):
        gil_workflow = self.create_user(email="gilbert@workflow.com", is_active=True)
        dan_workflow = self.create_user(email="dan@workflow.com", is_active=True)
        team_workflow = self.create_team(
            organization=self.organization, members=[gil_workflow, dan_workflow]
        )
        self.project.add_team(team_workflow)
        one_min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={
                "message": "hello",
                "exception": {"type": "Foo", "value": "uh oh"},
                "level": "error",
                "timestamp": one_min_ago,
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "Member",
            "targetIdentifier": str(self.user.id),
        }
        inject_workflow = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": ActionTargetType.TEAM.value,
            "targetIdentifier": str(team_workflow.id),
        }
        condition_data = {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}

        Rule.objects.filter(project=event.project).delete()
        Rule.objects.create(
            project=event.project,
            data={"conditions": [condition_data], "actions": [action_data, inject_workflow]},
        )

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(event),
                group_id=event.group_id,
            )

        assert len(mail.outbox) == 3
        sent_out_to = sorted(x for out in mail.outbox for x in out.to)
        assert sent_out_to == sorted([self.user.email, gil_workflow.email, dan_workflow.email])
        for x in [out.subject for out in mail.outbox]:
            assert "uh oh" in x
