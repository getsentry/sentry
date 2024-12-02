from unittest import mock

import pytest
from django.urls import reverse
from rest_framework.test import APITestCase as BaseAPITestCase

from fixtures.integrations.jira.mock import MockJira
from sentry.eventstore.models import Event
from sentry.integrations.jira import JiraCreateTicketAction, JiraIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.rule import Rule
from sentry.shared_integrations.exceptions import (
    ApiInvalidRequestError,
    IntegrationError,
    IntegrationFormError,
)
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.skips import requires_snuba
from sentry.types.rules import RuleFuture
from sentry.utils import json

pytestmark = [requires_snuba]


class JiraTicketRulesTestCase(RuleTestCase, BaseAPITestCase):
    rule_cls = JiraCreateTicketAction
    mock_jira = None
    broken_mock_jira = None

    def get_client(self):
        if not self.mock_jira:
            self.mock_jira = MockJira()
        return self.mock_jira

    def setUp(self):
        super().setUp()
        self.project_name = "Jira Cloud"
        self.integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="jira",
            name=self.project_name,
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        self.installation = self.integration.get_installation(self.organization.id)

        self.login_as(user=self.user)

    def trigger(self, event, rule_object):
        action = rule_object.data.get("actions", ())[0]
        action_inst = self.get_rule(data=action, rule=rule_object)
        results = list(action_inst.after(event=event))
        assert len(results) == 1

        rule_future = RuleFuture(rule=rule_object, kwargs=results[0].kwargs)
        return results[0].callback(event, futures=[rule_future])

    def get_key(self, event: Event):
        return ExternalIssue.objects.get_linked_issues(event, self.integration).values_list(
            "key", flat=True
        )[0]

    def configure_valid_alert_rule(self):
        response = self.client.post(
            reverse(
                "sentry-api-0-project-rules",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "project_id_or_slug": self.project.slug,
                },
            ),
            format="json",
            data={
                "name": "hello world",
                "owner": self.user.id,
                "environment": None,
                "actionMatch": "any",
                "frequency": 5,
                "actions": [
                    {
                        "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
                        "integration": self.integration.id,
                        "dynamic_form_fields": [{"name": "project"}],
                        "issuetype": "1",
                        "name": "Create a Jira ticket in the Jira Cloud account",
                        "project": "10000",
                    }
                ],
                "conditions": [],
            },
        )
        assert response.status_code == 200
        return response

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_ticket_rules(self, mock_record_event):
        with mock.patch(
            "sentry.integrations.jira.integration.JiraIntegration.get_client", self.get_client
        ):
            response = self.configure_valid_alert_rule()

            # Get the rule from DB
            rule_object = Rule.objects.get(id=response.data["id"])
            event = self.get_event()

            # Trigger its `after`
            self.trigger(event, rule_object)

            # assert ticket created in DB
            key = self.get_key(event)
            external_issue_count = len(ExternalIssue.objects.filter(key=key))
            assert external_issue_count == 1

            # assert ticket created on jira
            assert isinstance(self.installation, JiraIntegration)
            data = self.installation.get_issue(key)
            assert event.message in data["description"]

            # Trigger its `after` _again_
            self.trigger(event, rule_object)

            # assert new ticket NOT created in DB
            assert ExternalIssue.objects.count() == external_issue_count
            mock_record_event.assert_called_with(EventLifecycleOutcome.SUCCESS, None)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch.object(MockJira, "create_issue")
    def test_misconfigured_ticket_rule(self, mock_create_issue, mock_record_event):
        def raise_api_error(*args, **kwargs):
            raise ApiInvalidRequestError("Invalid data entered")

        mock_create_issue.side_effect = raise_api_error
        with mock.patch(
            "sentry.integrations.jira.integration.JiraIntegration.get_client", self.get_client
        ):
            response = self.configure_valid_alert_rule()

            rule_object = Rule.objects.get(id=response.data["id"])
            event = self.get_event()

            with pytest.raises(IntegrationError):
                # Trigger its `after`, but with a broken client which should raise
                # an ApiInvalidRequestError, which is reraised as an IntegrationError.
                self.trigger(event, rule_object)

            assert mock_record_event.call_count == 2
            start, failure = mock_record_event.mock_calls
            assert start.args == (EventLifecycleOutcome.STARTED,)
            assert failure.args == (
                EventLifecycleOutcome.FAILURE,
                "Error Communicating with Jira (HTTP 400): unknown error",
            )

    def test_fails_validation(self):
        """
        Test that the absence of dynamic_form_fields in the action fails validation
        """
        # Create a new Rule
        response = self.client.post(
            reverse(
                "sentry-api-0-project-rules",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "project_id_or_slug": self.project.slug,
                },
            ),
            format="json",
            data={
                "name": "hello world",
                "environment": None,
                "actionMatch": "any",
                "frequency": 5,
                "actions": [
                    {
                        "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
                        "integration": self.integration.id,
                        "issuetype": "1",
                        "name": "Create a Jira ticket in the Jira Cloud account",
                        "project": "10000",
                    }
                ],
                "conditions": [],
            },
        )
        assert response.status_code == 400
        assert response.data["actions"][0] == "Must configure issue link settings."

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    @mock.patch.object(MockJira, "create_issue")
    def test_fails_with_field_configuration_error(self, mock_create_issue, mock_record_halt):
        # Mock an error from the client response that cotains a field

        def raise_api_error_with_payload(*args, **kwargs):
            raise ApiInvalidRequestError(json.dumps({"errors": {"foo": "bar"}}))

        mock_create_issue.side_effect = raise_api_error_with_payload
        with mock.patch(
            "sentry.integrations.jira.integration.JiraIntegration.get_client", self.get_client
        ):
            response = self.configure_valid_alert_rule()

            rule_object = Rule.objects.get(id=response.data["id"])
            event = self.get_event()

            with pytest.raises(IntegrationFormError):
                # Trigger its `after`, but with a broken client which should raise
                # an ApiInvalidRequestError, which is reraised as an IntegrationError.
                self.trigger(event, rule_object)

            assert mock_record_halt.call_count == 1
            mock_record_event_args = mock_record_halt.call_args_list[0][0]
            assert mock_record_event_args[0] is not None

            metric_exception_message = mock_record_event_args[0]

            # The error message here is formatted by the Jira integration, and
            # only includes extracted JSON from the error
            assert metric_exception_message == "{'foo': ['bar']}"
