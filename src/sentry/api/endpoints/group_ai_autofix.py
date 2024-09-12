from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import orjson
import requests
from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from rest_framework.response import Response

from sentry import eventstore, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import EventSerializer, serialize
from sentry.autofix.utils import get_autofix_repos_from_project_code_mappings, get_autofix_state
from sentry.integrations.utils.code_mapping import get_sorted_code_mapping_configs
from sentry.models.group import Group
from sentry.seer.signed_seer_api import get_seer_salted_url, sign_with_seer_secret
from sentry.tasks.autofix import check_autofix_status
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.models.user import User
from sentry.users.services.user.service import user_service

logger = logging.getLogger(__name__)

from rest_framework.request import Request

TIMEOUT_SECONDS = 60 * 30  # 30 minutes


@region_silo_endpoint
class GroupAutofixEndpoint(GroupEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    # go away
    private = True
    enforce_rate_limit = True
    rate_limits = {
        "POST": {
            RateLimitCategory.IP: RateLimit(limit=10, window=60),
            RateLimitCategory.USER: RateLimit(limit=10, window=60),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=10, window=60),
        }
    }

    def _get_serialized_event(
        self, event_id: str, group: Group, user: AbstractBaseUser | AnonymousUser
    ) -> dict[str, Any] | None:
        event = eventstore.backend.get_event_by_id(group.project.id, event_id, group_id=group.id)

        if not event:
            return None

        serialized_event = serialize(event, user, EventSerializer())
        return serialized_event

    def _make_error_metadata(self, autofix: dict, reason: str):
        return {
            **autofix,
            "completed_at": datetime.now().isoformat(),
            "status": "ERROR",
            "fix": None,
            "error_message": reason,
            "steps": [],
        }

    def _respond_with_error(self, reason: str, status: int):
        return Response(
            {
                "detail": reason,
            },
            status=status,
        )

    def _call_autofix(
        self,
        user: User | AnonymousUser,
        group: Group,
        repos: list[dict],
        serialized_event: dict[str, Any],
        instruction: str,
        timeout_secs: int,
    ):
        path = "/v1/automation/autofix/start"

        # TODO
        hardcoded = {
            "organization_id": 1,
            "project_id": 1,
            "repos": [
                {
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "873328",
                }
            ],
            "issue": {
                "id": "5565249895",
                "title": "JSONDecodeError: unexpected character: line 1 column 1 (char 0)",
                "events": [
                    {
                        "id": "e9b16b635e6644fba1a391c006f3d83b",
                        "groupID": "5565249895",
                        "eventID": "e9b16b635e6644fba1a391c006f3d83b",
                        "projectID": "1",
                        "size": 22855,
                        "entries": [
                            {
                                "data": {
                                    "values": [
                                        {
                                            "type": "JSONDecodeError",
                                            "value": "unexpected character: line 1 column 1 (char 0)",
                                            "mechanism": {"type": "generic", "handled": True},
                                            "threadId": None,
                                            "module": "orjson",
                                            "stacktrace": {
                                                "frames": [
                                                    {
                                                        "filename": "sentry/api/base.py",
                                                        "absPath": "/usr/src/sentry/src/sentry/api/base.py",
                                                        "module": "sentry.api.base",
                                                        "package": None,
                                                        "platform": None,
                                                        "instructionAddr": None,
                                                        "symbolAddr": None,
                                                        "function": "handle_exception",
                                                        "rawFunction": None,
                                                        "symbol": None,
                                                        "context": [
                                                            [319, '        """'],
                                                            [320, "        try:"],
                                                            [
                                                                321,
                                                                "            # Django REST Framework's built-in exception handler. If `settings.EXCEPTION_HANDLER`",
                                                            ],
                                                            [
                                                                322,
                                                                "            # exists and returns a response, that's used. Otherwise, `exc` is just re-raised",
                                                            ],
                                                            [
                                                                323,
                                                                "            # and caught below.",
                                                            ],
                                                            [
                                                                324,
                                                                "            response = super().handle_exception(exc)",
                                                            ],
                                                            [
                                                                325,
                                                                "        except Exception as err:",
                                                            ],
                                                            [326, "            import sys"],
                                                            [
                                                                327,
                                                                "            import traceback",
                                                            ],
                                                            [328, ""],
                                                            [
                                                                329,
                                                                "            sys.stderr.write(traceback.format_exc())",
                                                            ],
                                                        ],
                                                        "lineNo": 324,
                                                        "colNo": None,
                                                        "inApp": True,
                                                        "trust": None,
                                                        "errors": None,
                                                        "lock": None,
                                                        "sourceLink": None,
                                                        "vars": {
                                                            "__class__": "<class 'sentry.api.base.Endpoint'>",
                                                            "err": "JSONDecodeError('unexpected character: line 1 column 1 (char 0)')",
                                                            "exc": "JSONDecodeError('unexpected character: line 1 column 1 (char 0)')",
                                                            "handler_context": "None",
                                                            "request": "<rest_framework.request.Request: POST '/extensions/slack/action/'>",
                                                            "scope": "<Scope id=0x7863399d58a0 name=None type=None>",
                                                            "self": "<sentry.integrations.slack.webhooks.action.SlackActionEndpoint object at 0x786360fbbce0>",
                                                            "sys": "<module 'sys' (built-in)>",
                                                            "traceback": "<module 'traceback' from '/usr/local/lib/python3.12/traceback.py'>",
                                                        },
                                                    },
                                                    {
                                                        "filename": "rest_framework/views.py",
                                                        "absPath": "/.venv/lib/python3.12/site-packages/rest_framework/views.py",
                                                        "module": "rest_framework.views",
                                                        "package": None,
                                                        "platform": None,
                                                        "instructionAddr": None,
                                                        "symbolAddr": None,
                                                        "function": "handle_exception",
                                                        "rawFunction": None,
                                                        "symbol": None,
                                                        "context": [
                                                            [464, ""],
                                                            [
                                                                465,
                                                                "        context = self.get_exception_handler_context()",
                                                            ],
                                                            [
                                                                466,
                                                                "        response = exception_handler(exc, context)",
                                                            ],
                                                            [467, ""],
                                                            [
                                                                468,
                                                                "        if response is None:",
                                                            ],
                                                            [
                                                                469,
                                                                "            self.raise_uncaught_exception(exc)",
                                                            ],
                                                            [470, ""],
                                                            [
                                                                471,
                                                                "        response.exception = True",
                                                            ],
                                                            [472, "        return response"],
                                                            [473, ""],
                                                            [
                                                                474,
                                                                "    def raise_uncaught_exception(self, exc):",
                                                            ],
                                                        ],
                                                        "lineNo": 469,
                                                        "colNo": None,
                                                        "inApp": False,
                                                        "trust": None,
                                                        "errors": None,
                                                        "lock": None,
                                                        "sourceLink": None,
                                                        "vars": {
                                                            "context": {
                                                                "args": [],
                                                                "kwargs": {},
                                                                "request": "<rest_framework.request.Request: POST '/extensions/slack/action/'>",
                                                                "view": "<sentry.integrations.slack.webhooks.action.SlackActionEndpoint object at 0x786360fbbce0>",
                                                            },
                                                            "exc": "JSONDecodeError('unexpected character: line 1 column 1 (char 0)')",
                                                            "exception_handler": "<function custom_exception_handler at 0x786391767a60>",
                                                            "response": "None",
                                                            "self": "<sentry.integrations.slack.webhooks.action.SlackActionEndpoint object at 0x786360fbbce0>",
                                                        },
                                                    },
                                                    {
                                                        "filename": "rest_framework/views.py",
                                                        "absPath": "/.venv/lib/python3.12/site-packages/rest_framework/views.py",
                                                        "module": "rest_framework.views",
                                                        "package": None,
                                                        "platform": None,
                                                        "instructionAddr": None,
                                                        "symbolAddr": None,
                                                        "function": "raise_uncaught_exception",
                                                        "rawFunction": None,
                                                        "symbol": None,
                                                        "context": [
                                                            [475, "        if settings.DEBUG:"],
                                                            [
                                                                476,
                                                                "            request = self.request",
                                                            ],
                                                            [
                                                                477,
                                                                "            renderer_format = getattr(request.accepted_renderer, 'format')",
                                                            ],
                                                            [
                                                                478,
                                                                "            use_plaintext_traceback = renderer_format not in ('html', 'api', 'admin')",
                                                            ],
                                                            [
                                                                479,
                                                                "            request.force_plaintext_errors(use_plaintext_traceback)",
                                                            ],
                                                            [480, "        raise exc"],
                                                            [481, ""],
                                                            [
                                                                482,
                                                                "    # Note: Views are made CSRF exempt from within `as_view` as to prevent",
                                                            ],
                                                            [
                                                                483,
                                                                "    # accidental removal of this exemption in cases where `dispatch` needs to",
                                                            ],
                                                            [484, "    # be overridden."],
                                                            [
                                                                485,
                                                                "    def dispatch(self, request, *args, **kwargs):",
                                                            ],
                                                        ],
                                                        "lineNo": 480,
                                                        "colNo": None,
                                                        "inApp": False,
                                                        "trust": None,
                                                        "errors": None,
                                                        "lock": None,
                                                        "sourceLink": None,
                                                        "vars": {
                                                            "exc": "JSONDecodeError('unexpected character: line 1 column 1 (char 0)')",
                                                            "self": "<sentry.integrations.slack.webhooks.action.SlackActionEndpoint object at 0x786360fbbce0>",
                                                        },
                                                    },
                                                    {
                                                        "filename": "sentry/api/base.py",
                                                        "absPath": "/usr/src/sentry/src/sentry/api/base.py",
                                                        "module": "sentry.api.base",
                                                        "package": None,
                                                        "platform": None,
                                                        "instructionAddr": None,
                                                        "symbolAddr": None,
                                                        "function": "dispatch",
                                                        "rawFunction": None,
                                                        "symbol": None,
                                                        "context": [
                                                            [
                                                                451,
                                                                '                op="base.dispatch.execute",',
                                                            ],
                                                            [
                                                                452,
                                                                '                description=".".join(',
                                                            ],
                                                            [
                                                                453,
                                                                '                    getattr(part, "__name__", None) or str(part) for part in (type(self), handler)',
                                                            ],
                                                            [454, "                ),"],
                                                            [455, "            ) as span:"],
                                                            [
                                                                456,
                                                                "                response = handler(request, *args, **kwargs)",
                                                            ],
                                                            [457, ""],
                                                            [
                                                                458,
                                                                "        except Exception as exc:",
                                                            ],
                                                            [
                                                                459,
                                                                "            response = self.handle_exception(request, exc)",
                                                            ],
                                                            [460, ""],
                                                            [461, "        if origin:"],
                                                        ],
                                                        "lineNo": 456,
                                                        "colNo": None,
                                                        "inApp": True,
                                                        "trust": None,
                                                        "errors": None,
                                                        "lock": None,
                                                        "sourceLink": None,
                                                        "vars": {
                                                            "args": [],
                                                            "exc": "JSONDecodeError('unexpected character: line 1 column 1 (char 0)')",
                                                            "handler": "<bound method SlackActionEndpoint.post of <sentry.integrations.slack.webhooks.action.SlackActionEndpoint object at 0x786360fbbce0>>",
                                                            "kwargs": {},
                                                            "method": "'post'",
                                                            "origin": "None",
                                                            "request": "<rest_framework.request.Request: POST '/extensions/slack/action/'>",
                                                            "self": "<sentry.integrations.slack.webhooks.action.SlackActionEndpoint object at 0x786360fbbce0>",
                                                            "span": "<Span(op='base.dispatch.execute', description:'SlackActionEndpoint.post', trace_id='8b3d8ed06b4b42698f6a0c5427fc3f74', span_id='af3f268d0a4ae171', parent_span_id='919b19d981f42ea9', sampled=True, origin='manual')>",
                                                            "start_time": "1726153211.4484243",
                                                        },
                                                    },
                                                    {
                                                        "filename": "sentry/integrations/slack/webhooks/action.py",
                                                        "absPath": "/usr/src/sentry/src/sentry/integrations/slack/webhooks/action.py",
                                                        "module": "sentry.integrations.slack.webhooks.action",
                                                        "package": None,
                                                        "platform": None,
                                                        "instructionAddr": None,
                                                        "symbolAddr": None,
                                                        "function": "post",
                                                        "rawFunction": None,
                                                        "symbol": None,
                                                        "context": [
                                                            [837, ""],
                                                            [
                                                                838,
                                                                "        if action_option in UNFURL_ACTION_OPTIONS:",
                                                            ],
                                                            [
                                                                839,
                                                                "            return self.handle_unfurl(slack_request, action_option)",
                                                            ],
                                                            [840, ""],
                                                            [
                                                                841,
                                                                '        if action_option in ["approve_member", "reject_member"]:',
                                                            ],
                                                            [
                                                                842,
                                                                "            return self.handle_member_approval(slack_request, action_option)",
                                                            ],
                                                            [843, ""],
                                                            [
                                                                844,
                                                                "        if action_option in NOTIFICATION_SETTINGS_ACTION_OPTIONS:",
                                                            ],
                                                            [
                                                                845,
                                                                "            return self.handle_enable_notifications(slack_request)",
                                                            ],
                                                            [846, ""],
                                                            [
                                                                847,
                                                                "        action_list = self.get_action_list(slack_request=slack_request)",
                                                            ],
                                                        ],
                                                        "lineNo": 842,
                                                        "colNo": None,
                                                        "inApp": True,
                                                        "trust": None,
                                                        "errors": None,
                                                        "lock": None,
                                                        "sourceLink": None,
                                                        "vars": {
                                                            "action_option": "'approve_member'",
                                                            "request": "<rest_framework.request.Request: POST '/extensions/slack/action/'>",
                                                            "self": "<sentry.integrations.slack.webhooks.action.SlackActionEndpoint object at 0x786360fbbce0>",
                                                            "slack_request": "<sentry.integrations.slack.requests.action.SlackActionRequest object at 0x786360fbad80>",
                                                        },
                                                    },
                                                    {
                                                        "filename": "sentry/integrations/slack/webhooks/action.py",
                                                        "absPath": "/usr/src/sentry/src/sentry/integrations/slack/webhooks/action.py",
                                                        "module": "sentry.integrations.slack.webhooks.action",
                                                        "package": None,
                                                        "platform": None,
                                                        "instructionAddr": None,
                                                        "symbolAddr": None,
                                                        "function": "handle_member_approval",
                                                        "rawFunction": None,
                                                        "symbol": None,
                                                        "context": [
                                                            [
                                                                863,
                                                                "        identity_user = slack_request.get_identity_user()",
                                                            ],
                                                            [864, ""],
                                                            [
                                                                865,
                                                                "        if not identity_user:",
                                                            ],
                                                            [
                                                                866,
                                                                "            return self.respond_with_text(NO_IDENTITY_MESSAGE)",
                                                            ],
                                                            [867, ""],
                                                            [
                                                                868,
                                                                '        member_id = slack_request.callback_data["member_id"]',
                                                            ],
                                                            [869, ""],
                                                            [870, "        try:"],
                                                            [
                                                                871,
                                                                "            member = OrganizationMember.objects.get_member_invite_query(member_id).get()",
                                                            ],
                                                            [
                                                                872,
                                                                "        except OrganizationMember.DoesNotExist:",
                                                            ],
                                                            [
                                                                873,
                                                                "            # member request is gone, likely someone else rejected it",
                                                            ],
                                                        ],
                                                        "lineNo": 868,
                                                        "colNo": None,
                                                        "inApp": True,
                                                        "trust": None,
                                                        "errors": None,
                                                        "lock": None,
                                                        "sourceLink": None,
                                                        "vars": {
                                                            "action": "'approve_member'",
                                                            "identity_user": "[Filtered]",
                                                            "self": "<sentry.integrations.slack.webhooks.action.SlackActionEndpoint object at 0x786360fbbce0>",
                                                            "slack_request": "<sentry.integrations.slack.requests.action.SlackActionRequest object at 0x786360fbad80>",
                                                        },
                                                    },
                                                    {
                                                        "filename": "django/utils/functional.py",
                                                        "absPath": "/.venv/lib/python3.12/site-packages/django/utils/functional.py",
                                                        "module": "django.utils.functional",
                                                        "package": None,
                                                        "platform": None,
                                                        "instructionAddr": None,
                                                        "symbolAddr": None,
                                                        "function": "__get__",
                                                        "rawFunction": None,
                                                        "symbol": None,
                                                        "context": [
                                                            [
                                                                42,
                                                                "        subsequent attribute access on the instance returns the cached value",
                                                            ],
                                                            [
                                                                43,
                                                                "        instead of calling cached_property.__get__().",
                                                            ],
                                                            [44, '        """'],
                                                            [
                                                                45,
                                                                "        if instance is None:",
                                                            ],
                                                            [46, "            return self"],
                                                            [
                                                                47,
                                                                "        res = instance.__dict__[self.name] = self.func(instance)",
                                                            ],
                                                            [48, "        return res"],
                                                            [49, ""],
                                                            [50, ""],
                                                            [51, "class classproperty:"],
                                                            [52, '    """'],
                                                        ],
                                                        "lineNo": 47,
                                                        "colNo": None,
                                                        "inApp": False,
                                                        "trust": None,
                                                        "errors": None,
                                                        "lock": None,
                                                        "sourceLink": None,
                                                        "vars": {
                                                            "cls": "<class 'sentry.integrations.slack.requests.action.SlackActionRequest'>",
                                                            "instance": "<sentry.integrations.slack.requests.action.SlackActionRequest object at 0x786360fbad80>",
                                                            "self": "<django.utils.functional.cached_property object at 0x7863e6bde540>",
                                                        },
                                                    },
                                                    {
                                                        "filename": "sentry/integrations/slack/requests/action.py",
                                                        "absPath": "/usr/src/sentry/src/sentry/integrations/slack/requests/action.py",
                                                        "module": "sentry.integrations.slack.requests.action",
                                                        "package": None,
                                                        "platform": None,
                                                        "instructionAddr": None,
                                                        "symbolAddr": None,
                                                        "function": "callback_data",
                                                        "rawFunction": None,
                                                        "symbol": None,
                                                        "context": [
                                                            [
                                                                53,
                                                                '                "is_app_unfurl"',
                                                            ],
                                                            [
                                                                54,
                                                                "            ):  # for actions taken on interactive unfurls",
                                                            ],
                                                            [
                                                                55,
                                                                "                return orjson.loads(",
                                                            ],
                                                            [
                                                                56,
                                                                '                    self.data["app_unfurl"]["blocks"][0]["block_id"],',
                                                            ],
                                                            [57, "                )"],
                                                            [
                                                                58,
                                                                '            return orjson.loads(self.data["message"]["blocks"][0]["block_id"])',
                                                            ],
                                                            [59, ""],
                                                            [
                                                                60,
                                                                '        if self.data["type"] == "view_submission":',
                                                            ],
                                                            [
                                                                61,
                                                                '            return orjson.loads(self.data["view"]["private_metadata"])',
                                                            ],
                                                            [62, ""],
                                                            [
                                                                63,
                                                                '        for data in self.data["message"]["blocks"]:',
                                                            ],
                                                        ],
                                                        "lineNo": 58,
                                                        "colNo": None,
                                                        "inApp": True,
                                                        "trust": None,
                                                        "errors": None,
                                                        "lock": None,
                                                        "sourceLink": None,
                                                        "vars": {
                                                            "self": "<sentry.integrations.slack.requests.action.SlackActionRequest object at 0x786360fbad80>"
                                                        },
                                                    },
                                                ],
                                                "framesOmitted": None,
                                                "registers": None,
                                                "hasSystemFrames": True,
                                            },
                                            "rawStacktrace": None,
                                        }
                                    ],
                                    "hasSystemFrames": True,
                                    "excOmitted": None,
                                },
                                "type": "exception",
                            },
                            {
                                "data": {
                                    "values": [
                                        {
                                            "type": "redis",
                                            "timestamp": "2024-09-12T15:00:11.447567Z",
                                            "level": "info",
                                            "message": "redis.pipeline.execute",
                                            "category": "redis",
                                            "data": {
                                                "redis.is_cluster": False,
                                                "redis.transaction": True,
                                            },
                                            "event_id": None,
                                        },
                                        {
                                            "type": "redis",
                                            "timestamp": "2024-09-12T15:00:11.447995Z",
                                            "level": "info",
                                            "message": "EVALSHA '4da4a9df8820ea72dcd577514dea186335046cb8' 1 'concurrent_limit:ip:default:POST:44.201.37.112' 25 'dee9cc01485147e4ae14a62e1c462632' 1726153211.447577 30",
                                            "category": "redis",
                                            "data": {
                                                "db.operation": "EVALSHA",
                                                "redis.command": "EVALSHA",
                                                "redis.is_cluster": False,
                                            },
                                            "event_id": None,
                                        },
                                        {
                                            "type": "log",
                                            "timestamp": "2024-09-12T15:00:11.449262Z",
                                            "level": "info",
                                            "message": "slack.action",
                                            "category": "sentry.integrations.slack.requests.base",
                                            "data": None,
                                            "event_id": None,
                                        },
                                        {
                                            "type": "http",
                                            "timestamp": "2024-09-12T15:00:11.520940Z",
                                            "level": "info",
                                            "message": None,
                                            "category": "httplib",
                                            "data": {
                                                "http.fragment": "",
                                                "http.method": "POST",
                                                "http.query": "",
                                                "http.response.status_code": 200,
                                                "reason": "OK",
                                                "thread.id": "132369994467008",
                                                "thread.name": "uWSGIWorker5Core9",
                                                "url": "http://sentry-rpc-prod-control.us.sentry.internal:8999/api/0/internal/rpc/integration/get_integration_identity_context/",
                                            },
                                            "event_id": None,
                                        },
                                        {
                                            "type": "log",
                                            "timestamp": "2024-09-12T15:00:11.522724Z",
                                            "level": "info",
                                            "message": "slack.action.request",
                                            "category": "sentry.integrations.slack.webhooks.action",
                                            "data": {
                                                "integration_id": 211266,
                                                "request_data": {
                                                    "api_app_id": "A011MFBJEUU",
                                                    "channel": {
                                                        "id": "D07F6ANCNVB",
                                                        "name": "directmessage",
                                                    },
                                                    "container": {
                                                        "channel_id": "D07F6ANCNVB",
                                                        "is_ephemeral": False,
                                                        "message_ts": "1726153196.293449",
                                                        "type": "message",
                                                    },
                                                    "enterprise": None,
                                                    "is_enterprise_install": False,
                                                    "team": {
                                                        "domain": "myedspaceworkspace",
                                                        "id": "T05RT58BHGT",
                                                    },
                                                    "token": "[Filtered]",
                                                    "trigger_id": "7742637174368.5877178391571.ef496e160042528889bd94c068f60ef0",
                                                    "type": "block_actions",
                                                    "user": {
                                                        "id": "U07A29F04UE",
                                                        "name": "atif.abdur-rahman",
                                                        "team_id": "T05RT58BHGT",
                                                        "username": "atif.abdur-rahman",
                                                    },
                                                },
                                                "trigger_id": "7742637174368.5877178391571.ef496e160042528889bd94c068f60ef0",
                                            },
                                            "event_id": None,
                                        },
                                        {
                                            "type": "http",
                                            "timestamp": "2024-09-12T15:00:11.543982Z",
                                            "level": "info",
                                            "message": None,
                                            "category": "httplib",
                                            "data": {
                                                "http.fragment": "",
                                                "http.method": "POST",
                                                "http.query": "",
                                                "http.response.status_code": 200,
                                                "reason": "OK",
                                                "thread.id": "132369994467008",
                                                "thread.name": "uWSGIWorker5Core9",
                                                "url": "http://sentry-rpc-prod-control.us.sentry.internal:8999/api/0/internal/rpc/integration/organization_contexts/",
                                            },
                                            "event_id": None,
                                        },
                                        {
                                            "type": "default",
                                            "timestamp": "2024-09-12T15:00:11.546438Z",
                                            "level": "info",
                                            "message": "SELECT sentry_organization.id, sentry_organization.name, sentry_organization.slug,\n       sentry_organization.status, sentry_organization.date_added, sentry_organization.default_role,\n       sentry_organization.is_test, sentry_organization.flags\nFROM sentry_organization\nWHERE sentry_organization.id = %s\nLIMIT 21",
                                            "category": "query",
                                            "data": None,
                                            "event_id": None,
                                            "messageFormat": "sql",
                                            "messageRaw": 'SELECT "sentry_organization"."id", "sentry_organization"."name", "sentry_organization"."slug", "sentry_organization"."status", "sentry_organization"."date_added", "sentry_organization"."default_role", "sentry_organization"."is_test", "sentry_organization"."flags" FROM "sentry_organization" WHERE "sentry_organization"."id" = %s LIMIT 21',
                                        },
                                    ]
                                },
                                "type": "breadcrumbs",
                            },
                            {
                                "data": {
                                    "apiTarget": None,
                                    "method": "POST",
                                    "url": "http://10.2.0.67:8999/extensions/slack/action/",
                                    "query": [],
                                    "fragment": None,
                                    "data": {"payload": "[Filtered]"},
                                    "headers": [
                                        ["Accept", "application/json,*/*"],
                                        ["Accept-Encoding", "gzip,deflate"],
                                        [
                                            "Baggage",
                                            "sentry-trace_id=8b3d8ed06b4b42698f6a0c5427fc3f74,sentry-environment=prod,sentry-release=backend%405d5cd64a72112104977d223bb3e7c32ca9a4bfaa,sentry-public_key=16427b2f210046b585ee51fd8a1ac54f,sentry-transaction=/extensions/slack/action/,sentry-sample_rate=1.0,sentry-sampled=true",
                                        ],
                                        ["Content-Length", "3397"],
                                        ["Content-Type", "application/x-www-form-urlencoded"],
                                        ["Host", "10.2.0.67:8999"],
                                        [
                                            "Sentry-Trace",
                                            "8b3d8ed06b4b42698f6a0c5427fc3f74-8ae1e5dff9890fb8-1",
                                        ],
                                        [
                                            "User-Agent",
                                            "Slackbot 1.0 (+https://api.slack.com/robots)",
                                        ],
                                        ["Via", "1.1 google"],
                                        [
                                            "X-Cloud-Trace-Context",
                                            "5f0f4c67ff391fbe44ba82cf90ca4daf/17350129970942481920",
                                        ],
                                        ["X-Envoy-Attempt-Count", "1"],
                                        ["X-Envoy-Expected-Rq-Timeout-Ms", "60000"],
                                        ["X-Forwarded-For", "44.201.37.112"],
                                        ["X-Forwarded-Proto", "http"],
                                        ["X-Glb-Tls-Cipher-Suite", "1302"],
                                        [
                                            "X-Glb-Tls-Ja3-Fingerprint",
                                            "4ea056e63b7910cbf543f0c095064dfe",
                                        ],
                                        ["X-Glb-Tls-Sni-Hostname", "sentry.io"],
                                        ["X-Glb-Tls-Version", "TLSv1.3"],
                                        ["X-Real-Ip", "44.201.37.112"],
                                        ["X-Request-Id", "1967c00e791c762a846d0f68a1c4bb89"],
                                        [
                                            "X-Sentry-Forwarded-For",
                                            "44.201.37.112,35.186.247.156, 44.201.37.112",
                                        ],
                                        ["X-Slack-Request-Timestamp", "1726153211"],
                                        [
                                            "X-Slack-Signature",
                                            "v0=c18c4647d9d1119a443426f348398454b0de12c3b5c61f76b61e439714e4c984",
                                        ],
                                    ],
                                    "cookies": [],
                                    "env": {
                                        "REMOTE_ADDR": "127.0.0.1",
                                        "SERVER_NAME": "getsentry-web-rpc-production-dd9d767f4-bdx87",
                                        "SERVER_PORT": "9000",
                                    },
                                    "inferredContentType": "application/x-www-form-urlencoded",
                                },
                                "type": "request",
                            },
                        ],
                        "dist": None,
                        "message": "",
                        "title": "JSONDecodeError: unexpected character: line 1 column 1 (char 0)",
                        "location": "sentry/integrations/slack/requests/action.py",
                        "user": {
                            "id": None,
                            "email": None,
                            "username": None,
                            "ip_address": "44.201.37.112",
                            "name": None,
                            "data": None,
                        },
                        "contexts": {
                            "browser": {
                                "name": "Slackbot",
                                "version": "1.0",
                                "type": "browser",
                            },
                            "device": {
                                "family": "Spider",
                                "model": "Desktop",
                                "brand": "Spider",
                                "type": "device",
                            },
                            "organization": {
                                "id": "4506383653732352",
                                "slug": "myedspace",
                                "type": "default",
                            },
                            "runtime": {
                                "name": "CPython",
                                "version": "3.12.3",
                                "build": "3.12.3 (main, May 14 2024, 07:34:56) [GCC 12.2.0]",
                                "type": "runtime",
                            },
                            "subscription": {
                                "id": 1941066,
                                "is-enterprise": False,
                                "is-paid": True,
                                "plan": "am3_team_auf",
                                "type": "default",
                            },
                            "trace": {
                                "trace_id": "8b3d8ed06b4b42698f6a0c5427fc3f74",
                                "span_id": "919b19d981f42ea9",
                                "parent_span_id": "b4052fe2e2e00753",
                                "op": "view.render",
                                "status": "unknown",
                                "client_sample_rate": 1.0,
                                "origin": "auto.http.django",
                                "sampled": False,
                                "data": {
                                    "thread.name": "uWSGIWorker5Core9",
                                    "thread.id": "132369994467008",
                                },
                                "description": "sentry-integration-slack-action",
                                "type": "trace",
                            },
                        },
                        "sdk": {"name": "sentry.python.django", "version": "2.12.0"},
                        "context": {"sys.argv": ["uwsgi"]},
                        "packages": {
                            "amqp": "5.2.0",
                            "anyio": "3.7.1",
                            "asgiref": "3.8.1",
                            "attrs": "23.1.0",
                            "avalara": "20.9.0",
                            "beautifulsoup4": "4.7.1",
                            "billiard": "4.2.0",
                            "boto3": "1.34.128",
                            "botocore": "1.34.128",
                            "brotli": "1.0.9",
                            "cachetools": "5.3.0",
                            "celery": "5.3.5",
                            "certifi": "2023.7.22",
                            "cffi": "1.15.1",
                            "charset-normalizer": "3.3.2",
                            "click": "8.1.7",
                            "click-didyoumean": "0.3.0",
                            "click-plugins": "1.1.1",
                            "click-repl": "0.3.0",
                            "confluent-kafka": "2.3.0",
                            "croniter": "1.3.10",
                            "cryptography": "42.0.4",
                            "cssselect": "1.0.3",
                            "cssutils": "2.9.0",
                            "datadog": "0.49.1",
                            "distro": "1.8.0",
                            "django": "5.1.1",
                            "django-crispy-forms": "1.14.0",
                            "django-pg-zero-downtime-migrations": "0.13",
                            "django_csp": "3.8",
                            "djangorestframework": "3.15.2",
                            "drf-spectacular": "0.26.3",
                            "email-reply-parser": "0.5.12",
                            "fastjsonschema": "2.16.2",
                            "fido2": "0.9.2",
                            "filelock": "3.15.3",
                            "getsentry": "0.0.0",
                            "google-api-core": "2.19.1",
                            "google-auth": "2.29.0",
                            "google-cloud-bigtable": "2.26.0",
                            "google-cloud-build": "3.24.2",
                            "google-cloud-core": "2.4.1",
                            "google-cloud-functions": "1.17.0",
                            "google-cloud-kms": "2.24.2",
                            "google-cloud-pubsub": "2.23.0",
                            "google-cloud-spanner": "3.49.0",
                            "google-cloud-storage": "2.18.0",
                            "google-crc32c": "1.6.0",
                            "google-resumable-media": "2.7.0",
                            "googleapis-common-protos": "1.63.2",
                            "grpc-google-iam-v1": "0.13.1",
                            "grpc-stubs": "1.53.0.5",
                            "grpcio": "1.60.1",
                            "grpcio-status": "1.60.1",
                            "h11": "0.14.0",
                            "hiredis": "2.3.2",
                            "httpcore": "1.0.2",
                            "httpx": "0.25.2",
                            "idna": "2.10",
                            "inflection": "0.5.1",
                            "iso3166": "2.1.1",
                            "isodate": "0.6.1",
                            "jmespath": "0.10.0",
                            "jsonschema": "4.20.0",
                            "jsonschema-specifications": "2023.7.1",
                            "kombu": "5.3.6",
                            "lxml": "4.9.3",
                            "maxminddb": "2.3.0",
                            "milksnake": "0.1.6",
                            "mistune": "2.0.4",
                            "mmh3": "4.0.0",
                            "msgpack": "1.0.7",
                            "oauthlib": "3.1.0",
                            "openai": "1.3.5",
                            "orjson": "3.10.3",
                            "packaging": "21.3",
                            "parsimonious": "0.10.0",
                            "petname": "2.6",
                            "phabricator": "0.7.0",
                            "phonenumberslite": "8.12.55",
                            "pillow": "10.2.0",
                            "pip": "24.0",
                            "progressbar2": "3.41.0",
                            "prompt-toolkit": "3.0.41",
                            "proto-plus": "1.24.0",
                            "protobuf": "5.27.3",
                            "psutil": "5.9.7",
                            "psycopg2-binary": "2.9.9",
                            "pyasn1": "0.4.5",
                            "pyasn1-modules": "0.2.4",
                            "pycountry": "17.5.14",
                            "pycparser": "2.21",
                            "pydantic": "1.10.17",
                            "pyjwt": "2.4.0",
                            "pymemcache": "4.0.0",
                            "pyparsing": "3.0.9",
                            "python-dateutil": "2.9.0",
                            "python-rapidjson": "1.8",
                            "python-u2flib-server": "5.0.0",
                            "python-utils": "3.3.3",
                            "python3-saml": "1.15.0",
                            "pyuwsgi": "2.0.27a1",
                            "pyvat": "1.3.15",
                            "pyyaml": "6.0.1",
                            "rb": "1.10.0",
                            "redis": "3.4.1",
                            "redis-py-cluster": "2.1.0",
                            "referencing": "0.30.2",
                            "regex": "2022.9.13",
                            "reportlab": "4.0.7",
                            "requests": "2.31.0",
                            "requests-file": "2.1.0",
                            "requests-oauthlib": "1.2.0",
                            "rfc3339-validator": "0.1.2",
                            "rfc3986-validator": "0.1.1",
                            "rpds-py": "0.15.2",
                            "rsa": "4.8",
                            "s3transfer": "0.10.0",
                            "sentry": "24.9.0.dev0",
                            "sentry-arroyo": "2.16.5",
                            "sentry-kafka-schemas": "0.1.106",
                            "sentry-protos": "0.1.19",
                            "sentry-redis-tools": "0.1.7",
                            "sentry-relay": "0.9.1",
                            "sentry-sdk": "2.12.0",
                            "sentry-usage-accountant": "0.0.10",
                            "sentry_ophio": "0.2.7",
                            "setuptools": "70.0.0",
                            "simplejson": "3.17.6",
                            "six": "1.16.0",
                            "slack_sdk": "3.27.2",
                            "sniffio": "1.3.0",
                            "snuba-sdk": "3.0.39",
                            "soupsieve": "2.3.2.post1",
                            "sqlparse": "0.5.0",
                            "statsd": "3.3.0",
                            "stripe": "3.1.0",
                            "structlog": "22.1.0",
                            "symbolic": "12.8.0",
                            "tiktoken": "0.6.0",
                            "tldextract": "5.1.2",
                            "toronado": "0.1.0",
                            "tqdm": "4.66.4",
                            "typing_extensions": "4.12.0",
                            "tzdata": "2023.3",
                            "ua-parser": "0.10.0",
                            "unidiff": "0.7.4",
                            "uritemplate": "4.1.1",
                            "urllib3": "2.2.2",
                            "vine": "5.1.0",
                            "wcwidth": "0.2.10",
                            "xmlsec": "1.3.13",
                            "zstandard": "0.18.0",
                        },
                        "type": "error",
                        "metadata": {
                            "filename": "sentry/integrations/slack/requests/action.py",
                            "function": "callback_data",
                            "in_app_frame_mix": "mixed",
                            "type": "JSONDecodeError",
                            "value": "unexpected character: line 1 column 1 (char 0)",
                        },
                        "tags": [
                            {"key": "browser", "value": "Slackbot 1.0"},
                            {"key": "browser.name", "value": "Slackbot"},
                            {"key": "device", "value": "Desktop"},
                            {"key": "device.family", "value": "Spider"},
                            {"key": "environment", "value": "prod"},
                            {"key": "handled", "value": "yes"},
                            {"key": "integration_id", "value": "211266"},
                            {"key": "level", "value": "error"},
                            {"key": "mechanism", "value": "generic"},
                            {"key": "organization", "value": "4506383653732352"},
                            {"key": "organization.slug", "value": "myedspace"},
                            {
                                "key": "release",
                                "value": "backend@e4e29c69e66ac07d2305c1ac164566f539b82730",
                            },
                            {"key": "runtime", "value": "CPython 3.12.3"},
                            {"key": "runtime.name", "value": "CPython"},
                            {"key": "sentry_region", "value": "us"},
                            {
                                "key": "server_name",
                                "value": "getsentry-web-rpc-production-dd9d767f4-bdx87",
                            },
                            {"key": "silo_mode", "value": "REGION"},
                            {"key": "subscription.is-enterprise", "value": "0"},
                            {"key": "subscription.is-paid", "value": "1"},
                            {"key": "subscription.plan", "value": "am3_team_auf"},
                            {"key": "transaction", "value": "/extensions/slack/action/"},
                            {
                                "key": "url",
                                "value": "http://10.2.0.67:8999/extensions/slack/action/",
                            },
                            {
                                "key": "user",
                                "value": "ip:44.201.37.112",
                                "query": 'user.ip:"44.201.37.112"',
                            },
                        ],
                        "platform": "python",
                        "dateReceived": "2024-09-12T15:00:11.733044Z",
                        "errors": [
                            {
                                "type": "invalid_data",
                                "message": "Discarded invalid value",
                                "data": {
                                    "name": "contexts.flags",
                                    "value": [],
                                    "reason": "expected an object",
                                },
                            }
                        ],
                        "occurrence": None,
                        "_meta": {
                            "entries": {
                                "0": {
                                    "data": {
                                        "values": {
                                            "0": {
                                                "": None,
                                                "type": None,
                                                "value": None,
                                                "mechanism": None,
                                                "threadId": None,
                                                "module": None,
                                                "stacktrace": {
                                                    "": None,
                                                    "frames": {
                                                        "5": {
                                                            "vars": {
                                                                "identity_user": {
                                                                    "": {
                                                                        "rem": [
                                                                            [
                                                                                "@password:filter",
                                                                                "s",
                                                                                0,
                                                                                10,
                                                                            ]
                                                                        ],
                                                                        "len": 769,
                                                                        "chunks": [
                                                                            {
                                                                                "type": "redaction",
                                                                                "text": "[Filtered]",
                                                                                "rule_id": "@password:filter",
                                                                                "remark": "s",
                                                                            }
                                                                        ],
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    },
                                                    "framesOmitted": None,
                                                    "registers": None,
                                                },
                                            }
                                        }
                                    }
                                },
                                "1": {
                                    "data": {
                                        "values": {
                                            "4": {
                                                "data": {
                                                    "request_data": {
                                                        "": {"len": 14},
                                                        "token": {
                                                            "": {
                                                                "rem": [
                                                                    [
                                                                        "@password:filter",
                                                                        "s",
                                                                        0,
                                                                        10,
                                                                    ]
                                                                ],
                                                                "len": 24,
                                                                "chunks": [
                                                                    {
                                                                        "type": "redaction",
                                                                        "text": "[Filtered]",
                                                                        "rule_id": "@password:filter",
                                                                        "remark": "s",
                                                                    }
                                                                ],
                                                            }
                                                        },
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                "2": {
                                    "data": {
                                        "": None,
                                        "apiTarget": None,
                                        "method": None,
                                        "url": None,
                                        "query": None,
                                        "data": {
                                            "payload": {
                                                "": {
                                                    "rem": [["@password:filter", "s", 0, 10]],
                                                    "len": 2305,
                                                    "chunks": [
                                                        {
                                                            "type": "redaction",
                                                            "text": "[Filtered]",
                                                            "rule_id": "@password:filter",
                                                            "remark": "s",
                                                        }
                                                    ],
                                                }
                                            }
                                        },
                                        "headers": None,
                                        "cookies": None,
                                        "env": None,
                                    }
                                },
                            },
                            "message": None,
                            "user": None,
                            "contexts": {
                                "flags": {
                                    "": {
                                        "err": [["invalid_data", {"reason": "expected an object"}]],
                                        "val": [],
                                    }
                                }
                            },
                            "sdk": None,
                            "context": None,
                            "packages": None,
                            "tags": {},
                        },
                        "crashFile": None,
                        "culprit": "/extensions/slack/action/",
                        "dateCreated": "2024-09-12T15:00:11Z",
                        "fingerprints": [
                            "dbbeb4c97e1c000e394c4f16ea2bae20",
                            "9635678472134bb72e0e612d28166000",
                        ],
                        "groupingConfig": {
                            "enhancements": "KLUv_SCrDQQAgoccI7CnDVQUpQkWg3WZl4GVObL7IItQShcbOqCaSEq4PSwiGyEBCboIuvZFbwr9z_Jm0b8YezsLrsfvusXHrAUeVApY43fPPDSqTdBF0LUp8bc786Nk1pj6hP1s8OeUpKNahVKKWpQBszCEdnQ-oiGjAhIBBBAFLNdQx6dwQXVn",
                            "id": "newstyle:2023-01-11",
                        },
                        "release": {
                            "id": 1227522566,
                            "version": "backend@e4e29c69e66ac07d2305c1ac164566f539b82730",
                            "status": "open",
                            "shortVersion": "backend@e4e29c69e66ac07d2305c1ac164566f539b82730",
                            "versionInfo": {
                                "package": "backend",
                                "version": {"raw": "e4e29c69e66ac07d2305c1ac164566f539b82730"},
                                "description": "e4e29c69e66a",
                                "buildHash": "e4e29c69e66ac07d2305c1ac164566f539b82730",
                            },
                            "ref": None,
                            "url": None,
                            "dateReleased": None,
                            "dateCreated": "2024-09-12T13:28:16.161184Z",
                            "data": {},
                            "newGroups": 0,
                            "owner": None,
                            "commitCount": 1,
                            "lastCommit": {
                                "id": "e4e29c69e66ac07d2305c1ac164566f539b82730",
                                "message": "feat(whats-new): add product to targetedbroadcast serializer & validator (#15096)",
                                "dateCreated": "2024-09-12T12:47:16Z",
                                "pullRequest": {
                                    "id": "15096",
                                    "title": "feat(whats-new): add product to targetedbroadcast serializer & validator",
                                    "message": None,
                                    "dateCreated": "2024-09-12T11:47:17.271485Z",
                                    "repository": {
                                        "id": "2",
                                        "name": "getsentry/getsentry",
                                        "url": "https://github.com/getsentry/getsentry",
                                        "provider": {
                                            "id": "integrations:github",
                                            "name": "GitHub",
                                        },
                                        "status": "active",
                                        "dateCreated": "2016-10-10T21:36:45.373994Z",
                                        "integrationId": "2933",
                                        "externalSlug": "getsentry/getsentry",
                                        "externalId": "3060925",
                                    },
                                    "author": {
                                        "id": "3142223",
                                        "name": "simon.hellmayr@sentry.io",
                                        "username": "e5aea6c439234776bfb2d7921872b460",
                                        "email": "simon.hellmayr@sentry.io",
                                        "avatarUrl": "https://gravatar.com/avatar/5be64663623de757c4cc11d52f6b6b7c13c48d76dc8b95d58a314f344b9fd52f?s=32&d=mm",
                                        "isActive": True,
                                        "hasPasswordAuth": False,
                                        "isManaged": False,
                                        "dateJoined": "2024-04-02T13:24:35.564558Z",
                                        "lastLogin": "2024-09-12T14:02:27.388553Z",
                                        "has2fa": True,
                                        "lastActive": "2024-09-12T14:17:34.198922Z",
                                        "isSuperuser": True,
                                        "isStaff": True,
                                        "experiments": {},
                                        "emails": [
                                            {
                                                "id": "3291626",
                                                "email": "simon.hellmayr@sentry.io",
                                                "is_verified": True,
                                            }
                                        ],
                                        "avatar": {
                                            "avatarType": "letter_avatar",
                                            "avatarUuid": None,
                                            "avatarUrl": None,
                                        },
                                    },
                                    "externalUrl": "https://github.com/getsentry/getsentry/pull/15096",
                                },
                                "suspectCommitType": "",
                                "repository": {
                                    "id": "2",
                                    "name": "getsentry/getsentry",
                                    "url": "https://github.com/getsentry/getsentry",
                                    "provider": {"id": "integrations:github", "name": "GitHub"},
                                    "status": "active",
                                    "dateCreated": "2016-10-10T21:36:45.373994Z",
                                    "integrationId": "2933",
                                    "externalSlug": "getsentry/getsentry",
                                    "externalId": "3060925",
                                },
                                "author": {
                                    "name": "Simon Hellmayr",
                                    "email": "shellmayr@users.noreply.github.com",
                                },
                                "releases": [
                                    {
                                        "version": "frontend@e4e29c69e66ac07d2305c1ac164566f539b82730",
                                        "shortVersion": "frontend@e4e29c69e66ac07d2305c1ac164566f539b82730",
                                        "ref": None,
                                        "url": None,
                                        "dateReleased": None,
                                        "dateCreated": "2024-09-12T13:02:34.009485Z",
                                    },
                                    {
                                        "version": "backend@e4e29c69e66ac07d2305c1ac164566f539b82730",
                                        "shortVersion": "backend@e4e29c69e66ac07d2305c1ac164566f539b82730",
                                        "ref": None,
                                        "url": None,
                                        "dateReleased": None,
                                        "dateCreated": "2024-09-12T13:28:16.161184Z",
                                    },
                                    {
                                        "version": "control@e4e29c69e66ac07d2305c1ac164566f539b82730",
                                        "shortVersion": "control@e4e29c69e66ac07d2305c1ac164566f539b82730",
                                        "ref": None,
                                        "url": None,
                                        "dateReleased": None,
                                        "dateCreated": "2024-09-12T14:56:46.255417Z",
                                    },
                                ],
                            },
                            "deployCount": 4,
                            "lastDeploy": {
                                "id": "58889626",
                                "environment": "prod",
                                "dateStarted": None,
                                "dateFinished": "2024-09-12T14:36:26.871469Z",
                                "name": "backend@e4e29c69e66ac07d2305c1ac164566f539b82730 to prod",
                                "url": None,
                            },
                            "authors": [
                                {
                                    "name": "Simon Hellmayr",
                                    "email": "shellmayr@users.noreply.github.com",
                                }
                            ],
                            "projects": [
                                {
                                    "id": 1,
                                    "slug": "sentry",
                                    "name": "Backend",
                                    "newGroups": 0,
                                    "platform": "python",
                                    "platforms": ["native", "other", "python"],
                                    "hasHealthData": False,
                                }
                            ],
                            "firstEvent": "2024-09-12T13:31:05Z",
                            "lastEvent": "2024-09-12T15:01:37Z",
                            "currentProjectMeta": {},
                            "userAgent": "Python-urllib/3.11",
                        },
                        "userReport": None,
                        "sdkUpdates": [],
                        "resolvedWith": [],
                        "nextEventID": None,
                        "previousEventID": "96422b4297b54256bd387db9bf3c3cd8",
                    }
                ],
            },
            "invoking_user": {"id": 1, "display_name": "Rohan Agarwal"},
        }

        hardcoded["issue"]["id"] = group.id

        body = orjson.dumps(
            {
                "organization_id": group.organization.id,
                "project_id": group.project.id,
                "repos": hardcoded["repos"],
                "issue": hardcoded["issue"],
                "instruction": instruction,
                "timeout_secs": timeout_secs,
                "last_updated": datetime.now().isoformat(),
                "invoking_user": (
                    {
                        "id": user.id,
                        "display_name": user.get_display_name(),
                    }
                    if not isinstance(user, AnonymousUser)
                    else None
                ),
                "options": {
                    "disable_codebase_indexing": features.has(
                        "organizations:autofix-disable-codebase-indexing",
                        group.organization,
                        actor=user,
                    )
                },
            },
            option=orjson.OPT_NON_STR_KEYS,
        )

        url, salt = get_seer_salted_url(f"{settings.SEER_AUTOFIX_URL}{path}")
        response = requests.post(
            url,
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(
                    salt,
                    body=body,
                ),
            },
        )

        response.raise_for_status()

        return response.json().get("run_id")

    def post(self, request: Request, group: Group) -> Response:
        data = orjson.loads(request.body)

        # This event_id is the event that the user is looking at when they click the "Fix" button
        event_id = data.get("event_id", None)
        if event_id is None:
            event = group.get_recommended_event_for_environments()
            if not event:
                event = group.get_latest_event()

            if not event:
                return Response(
                    {
                        "detail": "Could not find an event for the issue, please try providing an event_id"
                    },
                    status=400,
                )
            event_id = event.event_id

        created_at = datetime.now().isoformat()

        if not (
            features.has("projects:ai-autofix", group.project)
            or features.has("organizations:autofix", group.organization)
        ):
            return self._respond_with_error("AI Autofix is not enabled for this project.", 403)

        # For now we only send the event that the user is looking at, in the near future we want to send multiple events.
        serialized_event = self._get_serialized_event(event_id, group, request.user)

        if serialized_event is None:
            return self._respond_with_error("Cannot fix issues without an event.", 400)

        if not any([entry.get("type") == "exception" for entry in serialized_event["entries"]]):
            return self._respond_with_error("Cannot fix issues without a stacktrace.", 400)

        repos = get_autofix_repos_from_project_code_mappings(group.project)

        # TODO if not repos:
        #     return self._respond_with_error(
        #         "Found no Github repositories linked to this project. Please set up the Github Integration and code mappings if you haven't",
        #         400,
        #     )

        try:
            run_id = self._call_autofix(
                request.user,
                group,
                repos,
                serialized_event,
                data.get("instruction", data.get("additional_context", "")),
                TIMEOUT_SECONDS,
            )
        except Exception as e:
            logger.exception(
                "Failed to send autofix to seer",
                extra={
                    "group_id": group.id,
                    "created_at": created_at,
                    "exception": e,
                },
            )

            return self._respond_with_error(
                "Autofix failed to start.",
                500,
            )

        check_autofix_status.apply_async(args=[run_id], countdown=timedelta(minutes=15).seconds)

        return Response(
            status=202,
        )

    def get(self, request: Request, group: Group) -> Response:
        autofix_state = get_autofix_state(group_id=group.id)

        response_state: dict[str, Any] | None = None

        if autofix_state:
            response_state = autofix_state.dict()
            user_ids = autofix_state.actor_ids
            if user_ids:
                users = user_service.serialize_many(
                    filter={"user_ids": user_ids, "organization_id": request.organization.id},
                    as_user=request.user,
                )

                users_map = {user["id"]: user for user in users}

                response_state["users"] = users_map

            project = group.project
            repositories = []
            if project:
                code_mappings = get_sorted_code_mapping_configs(project=project)
                for mapping in code_mappings:
                    repo = mapping.repository
                    repositories.append(
                        {
                            "url": repo.url,
                            "external_id": repo.external_id,
                            "name": repo.name,
                            "provider": repo.provider,
                            "default_branch": mapping.default_branch,
                        }
                    )
            response_state["repositories"] = repositories

        return Response({"autofix": response_state})
