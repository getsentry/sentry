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


@instrumented_task(name='sentry.tasks.email_unlink_notifications', queue='auth')
def email_unlink_notifications(org_id, actor_id, provider_key):
    try:
        org = Organization.objects.get(id=org_id)
        actor = User.objects.get(id=actor_id)
        provider = manager.get(provider_key)
    except(Organization.DoesNotExist, User.DoesNotExist, ProviderNotRegistered) as e:
        logger.warning('Could not send SSO unlink emails: %s', e)
        return

    # Email all organization users, even if they never linked their accounts.
    # This provides a better experience in the case where SSO is enabled and
    # disabled in the timespan of users checking their email.
    member_list = OrganizationMember.objects.filter(organization=org).select_related('user')

    for member in member_list:
        member.send_sso_unlink_email(actor, provider)
