from __future__ import absolute_import

import six
from django.core import mail

from sentry.mail.actions import ActionTargetType, NotifyEmailAction, NotifyEmailForm
from sentry.models import OrganizationMember, OrganizationMemberTeam, Rule
from sentry.testutils import TestCase
from sentry.testutils.cases import RuleTestCase
from sentry.tasks.post_process import post_process_group
from sentry.testutils.helpers.datetime import iso_format, before_now


class NotifyEmailFormTest(TestCase):
    TARGET_TYPE_KEY = "targetType"
    TARGET_IDENTIFIER_KEY = "targetIdentifier"

    def setUp(self):
        super(NotifyEmailFormTest, self).setUp()
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
            "targetIdentifier": six.text_type(self.user.id),
        }
        condition_data = {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}

        Rule.objects.filter(project=event.project).delete()
        Rule.objects.create(
            project=event.project, data={"conditions": [condition_data], "actions": [action_data]}
        )

        with self.tasks():
            post_process_group(
                event=event, is_new=True, is_regression=False, is_new_group_environment=False
            )

        assert len(mail.outbox) == 1
        sent = mail.outbox[0]
        assert sent.to == [self.user.email]
        assert "uh oh" in sent.subject
