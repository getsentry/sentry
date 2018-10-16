from __future__ import absolute_import
import re

from django.core.urlresolvers import reverse

from sentry.models import Integration, OrganizationIntegration
from sentry.utils.http import absolute_uri

VSTS_WEBHOOK_URL = absolute_uri(reverse('sentry-extensions-vsts-issue-updated'))


def get_integrations_without_subscriptions():
    integrations = []
    for integration in Integration.objects.filter(provider='vsts'):
        if 'subscription' not in integration.metadata:
            integrations.append(integration)
    return [i.id for i in integrations]


def get_shared_secret(subscription_headers):
    result = re.search(r'shared-secret:(\w+)', subscription_headers)
    shared_secret = result.group(1)
    return shared_secret


def is_vsts_integration_subscription(subscription):
    return subscription['consumerInputs']['url'] == VSTS_WEBHOOK_URL \
        and subscription['eventType'] == 'workitem.updated' \
        and subscription['consumerId'] == 'webHooks'


def update_subscription(integration, organization_id):
    installation = integration.get_installation(organization_id)
    client = installation.get_client()

    # Get all subscriptions the user has access to
    resp = client.get(
        '%s_apis/hooks/subscriptions?api-version=4.1' %
        (integration.metadata['domain_name']))

    for subscription in resp['value']:
        if not is_vsts_integration_subscription(subscription):
            continue
        shared_secret = get_shared_secret(subscription['consumerInputs']['httpHeaders'])
        if subscription['status'] == 'disabledBySystem':
            # TODO(lb): test will not pass until a PR is merged that makes this work
            client.update_subscription(installation.instance, subscription['id'], shared_secret)
        integration.metadata['subscription'] = {
            'id': subscription['id'],
            'secret': shared_secret,
        }
        integration.save()

        # We only need one webhook per integration.
        # If this process is successful move onto the next integrtation to fix.
        return


def fix_integration_subscriptions():
    integration_ids = get_integrations_without_subscriptions()
    org_integrations = OrganizationIntegration.objects.filter(
        integration_id__in=integration_ids
    ).select_related('integration')

    for org_integration in org_integrations:
        integration = org_integration.integration
        # Check that we are only updating each integration once.
        # Once an integration_id has been removed do not try it again.
        try:
            integration_ids.remove(integration.id)
        except ValueError:
            continue

        try:
            update_subscription(integration, org_integration.organization.id)
        except Exception:
            # If there is a failure encountered while updating the subscription,
            # Try again (if there is another org with the same integration installed)
            integration_ids.add(integration.id)
