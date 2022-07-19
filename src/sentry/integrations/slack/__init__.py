from sentry.rules import rules

from .actions.form import *  # noqa: F401,F403
from .actions.notification import *  # noqa: F401,F403
from .actions.notification import SlackNotifyServiceAction
from .analytics import *  # noqa: F401,F403
from .client import *  # noqa: F401,F403
from .integration import *  # noqa: F401,F403
from .message_builder.base.base import *  # noqa: F401,F403
from .message_builder.base.block import *  # noqa: F401,F403
from .message_builder.disconnected import *  # noqa: F401,F403
from .message_builder.discover import *  # noqa: F401,F403
from .message_builder.event import *  # noqa: F401,F403
from .message_builder.help import *  # noqa: F401,F403
from .message_builder.incidents import *  # noqa: F401,F403
from .message_builder.issues import *  # noqa: F401,F403
from .message_builder.metric_alerts import *  # noqa: F401,F403
from .message_builder.notifications.base import *  # noqa: F401,F403
from .message_builder.notifications.digest import *  # noqa: F401,F403
from .message_builder.notifications.issues import *  # noqa: F401,F403
from .message_builder.prompt import *  # noqa: F401,F403
from .notifications import *  # noqa: F401,F403
from .requests.action import *  # noqa: F401,F403
from .requests.base import *  # noqa: F401,F403
from .requests.command import *  # noqa: F401,F403
from .requests.event import *  # noqa: F401,F403
from .unfurl.discover import *  # noqa: F401,F403
from .unfurl.issues import *  # noqa: F401,F403
from .unfurl.metric_alerts import *  # noqa: F401,F403
from .urls import *  # noqa: F401,F403
from .utils.auth import *  # noqa: F401,F403
from .utils.channel import *  # noqa: F401,F403
from .utils.escape import *  # noqa: F401,F403
from .utils.notifications import *  # noqa: F401,F403
from .utils.rule_status import *  # noqa: F401,F403
from .utils.users import *  # noqa: F401,F403
from .views.link_identity import *  # noqa: F401,F403
from .views.link_team import *  # noqa: F401,F403
from .views.unlink_identity import *  # noqa: F401,F403
from .views.unlink_team import *  # noqa: F401,F403
from .webhooks.action import *  # noqa: F401,F403
from .webhooks.base import *  # noqa: F401,F403
from .webhooks.command import *  # noqa: F401,F403
from .webhooks.event import *  # noqa: F401,F403

rules.add(SlackNotifyServiceAction)
