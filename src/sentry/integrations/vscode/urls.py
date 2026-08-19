from django.urls import re_path

from .endpoints.action import VSCodeActionEndpoint
from .endpoints.chat import VSCodeChatEndpoint

urlpatterns = [
    re_path(r"^chat/$", VSCodeChatEndpoint.as_view(), name="sentry-integration-vscode-chat"),
    re_path(r"^action/$", VSCodeActionEndpoint.as_view(), name="sentry-integration-vscode-action"),
]
