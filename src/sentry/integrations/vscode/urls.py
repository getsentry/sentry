from django.urls import re_path

from .endpoints.action import VSCodeActionEndpoint
from .endpoints.chat import VSCodeChatDetailsEndpoint, VSCodeChatIndexEndpoint

urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/chat/$",
        VSCodeChatIndexEndpoint.as_view(),
        name="sentry-integration-vscode-chat",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/chat/(?P<session_id>[^/]+)/$",
        VSCodeChatDetailsEndpoint.as_view(),
        name="sentry-integration-vscode-chat-session",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/action/(?P<session_id>[^/]+)/$",
        VSCodeActionEndpoint.as_view(),
        name="sentry-integration-vscode-action",
    ),
]
