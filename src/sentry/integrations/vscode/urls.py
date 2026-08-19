from django.urls import re_path

from .endpoints.action import VSCodeActionEndpoint
from .endpoints.chat import VSCodeChatEndpoint

urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/chat/$",
        VSCodeChatEndpoint.as_view(),
        name="sentry-integration-vscode-chat",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/chat/(?P<session_id>[^/]+)/$",
        VSCodeChatEndpoint.as_view(),
        name="sentry-integration-vscode-chat-session",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/action/(?P<session_id>[^/]+)/$",
        VSCodeActionEndpoint.as_view(),
        name="sentry-integration-vscode-action",
    ),
]
