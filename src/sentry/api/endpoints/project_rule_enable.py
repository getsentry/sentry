from django.conf import settings
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.api_owners import ApiOwner
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.rule import RuleSerializer
from sentry.constants import ObjectStatus
from sentry.models import Rule

class ProjectRuleEnableEndpoint(RuleEndpoint):
	def put(self, request: Request, project, rule) -> Response:
		# take in a rule
		alert_rule = Rule.objects.get(id=rule.id)
		# check to see if it's "bad" aka the same checks as in dupe and no actions (refactor)
		# enable it if no issues
		# return error message with why it can't be enabled if it's "bad"
