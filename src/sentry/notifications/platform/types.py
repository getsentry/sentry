from typing import TypeVar

NotificationRenderable = TypeVar("NotificationRenderable")
"""
A renderable object that is understood by the notification provider.
For example, Email might expect HTML, or raw text; Slack might expect a JSON Block Kit object.
"""
