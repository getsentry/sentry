from __future__ import absolute_import, print_function

import logging

from sentry.models import Organization, OrganizationMember, User
from sentry.tasks.base import instrumented_task
from sentry.auth import manager
from sentry.auth.exceptions import ProviderNotRegistered

logger = logging.getLogger('sentry.auth')


@instrumented_task(name='sentry.tasks.send_sso_link_emails', queue='auth')
def email_missing_links(org_id, actor_id, provider_key, **kwargs):
    try:
        org = Organization.objects.get(id=org_id)
        actor = User.objects.get(id=actor_id)
        provider = manager.get(provider_key)
    except(Organization.DoesNotExist, User.DoesNotExist, ProviderNotRegistered) as e:
        logger.warning('Could not send SSO link emails: %s', e)
        return

    member_list = OrganizationMember.objects.filter(
        organization=org,
        flags=~getattr(OrganizationMember.flags, 'sso:linked'),
    )
    for member in member_list:
        member.send_sso_link_email(actor, provider)
