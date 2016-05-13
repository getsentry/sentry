from __future__ import absolute_import, print_function

import logging

from sentry.models import Organization, OrganizationMember
from sentry.tasks.base import instrumented_task

logger = logging.getLogger('sentry.auth')


@instrumented_task(name='sentry.tasks.send_sso_link_emails', queue='auth')
def email_missing_links(organization_id, **kwargs):
    try:
        org = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            'Organization(id=%s) does not exist',
            organization_id,
        )
        return

    member_list = OrganizationMember.objects.filter(
        organization=org,
        flags=~getattr(OrganizationMember.flags, 'sso:linked'),
    )
    for member in member_list:
        member.send_sso_link_email()
