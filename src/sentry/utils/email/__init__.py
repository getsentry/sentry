__all__ = (
    "_CaseInsensitiveSigner",
    "create_fake_email",
    "email_to_group_id",
    "get_connection",
    "get_email_addresses",
    "group_id_to_email",
    "inline_css",
    "is_smtp_enabled",
    "ListResolver",
    "MessageBuilder",
    "PreviewBackend",
    "send_mail",
    "send_messages",
)

"""
This is the Email Module. It contains a hodgepodge of helpers for things like
parsing email address strings, building and sending messages, and looking up
user emails in the database.
"""

from .address import email_to_group_id, group_id_to_email
from .backend import PreviewBackend, is_smtp_enabled
from .faker import create_fake_email
from .list_resolver import ListResolver
from .manager import get_email_addresses
from .message_builder import MessageBuilder, inline_css
from .send import get_connection, send_mail, send_messages
from .signer import _CaseInsensitiveSigner
