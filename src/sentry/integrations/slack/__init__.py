# handle additional_attachment_manager frist
from .additional_attachment_manager import AdditionalAttachmentManager

manager = AdditionalAttachmentManager()
register_additional_attachment_generator = manager.register_additional_attachment_generator
get_additional_attachment = manager.get_additional_attachment

from sentry.rules import rules
from sentry.utils.imports import import_submodules

from .client import SlackClient  # NOQA
from .notify_action import SlackNotifyServiceAction

path = __path__  # type: ignore
import_submodules(globals(), __name__, path)

rules.add(SlackNotifyServiceAction)
