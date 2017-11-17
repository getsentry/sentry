from __future__ import absolute_import
from sentry.models import ApiKey, AuditLogEntry


def create_audit_entry(request, transaction_id=None, logger=None, **kwargs):

    user = request.user if request.user.is_authenticated() else None
    api_key = request.auth if hasattr(request, 'auth') \
        and isinstance(request.auth, ApiKey) else None

    entry = AuditLogEntry(
        actor=user, actor_key=api_key, ip_address=request.META['REMOTE_ADDR'], **kwargs
    )

    # Only create a real AuditLogEntry record if we are passing an event type
    # otherwise, we want to still log to our actual logging
    if entry.event is not None:
        entry.save()

    extra = {
        'ip_address': entry.ip_address,
        'organization_id': entry.organization_id,
        'object_id': entry.target_object,
        'entry_id': entry.id,
        'actor_label': entry.actor_label
    }
    if entry.actor_id:
        extra['actor_id'] = entry.actor_id
    if entry.actor_key_id:
        extra['actor_key_id'] = entry.actor_key_id
    if transaction_id is not None:
        extra['transaction_id'] = transaction_id

    if logger:
        logger.info(entry.get_event_display(), extra=extra)

    return entry
