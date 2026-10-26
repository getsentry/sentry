from __future__ import annotations

from typing import NotRequired, TypedDict

from rest_framework import serializers

from sentry.seer.models.agent_write_grant import AGENT_SESSION_ID_MAX_LENGTH


class AgentSessionRequestData(TypedDict):
    sessionId: str


class AgentTokenRequestData(AgentSessionRequestData):
    requestedScopes: NotRequired[list[str]]


class AgentApprovalRequestData(AgentSessionRequestData):
    scopes: list[str]


class AgentSessionRequestSerializer(serializers.Serializer):
    sessionId = serializers.CharField(max_length=AGENT_SESSION_ID_MAX_LENGTH)


class AgentTokenRequestSerializer(AgentSessionRequestSerializer):
    requestedScopes = serializers.ListField(child=serializers.CharField(), required=False)


class AgentApprovalRequestSerializer(AgentSessionRequestSerializer):
    scopes = serializers.ListField(child=serializers.CharField())
