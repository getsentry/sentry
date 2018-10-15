from __future__ import absolute_import
import re

from django.core.urlresolvers import reverse

from sentry.models import Integration, OrganizationIntegration
from sentry.utils.http import absolute_uri


def fix_integrations():
    url = absolute_uri(reverse('sentry-extensions-vsts-issue-updated'))
    integrations = []
    for integration in Integration.objects.filter(provider='vsts'):
        if 'subscription' not in integration.metadata:
            integrations.append(integration)

    integration_ids = [i.id for i in integrations]
    org_integrations = OrganizationIntegration.objects.filter(
        integration_id__in=integration_ids
    ).select_related('integration')

    for org_integration in org_integrations:
        integration = org_integration.integration
        try:
            integration_ids.remove(integration.id)
        except ValueError:
            continue
        installation = integration.get_installation(org_integration.organization_id)
        client = installation.get_client()
        resp = client.get(
            '%s_apis/hooks/subscriptions?api-version=4.1' %
            (integration.metadata['domain_name']))

        for subscription in resp['value']:
            if subscription['consumerInputs']['url'] != url:
                continue
            result = re.search(
                r'shared-secret:(\w+)',
                subscription['consumerInputs']['httpHeaders'])
            shared_secret = result.group(1)
            if subscription['status'] == 'disabledBySystem':
                resp = client.put(
                    '%s_apis/hooks/subscriptions/%s?api-version=4.1' % (
                        integration.metadata['domain_name'], subscription['id']),
                    data={
                        'publisherId': 'tfs',
                        'eventType': 'workitem.updated',
                        'resourceVersion': '1.0',
                        'consumerId': 'webHooks',
                        'consumerActionId': 'httpRequest',
                        'consumerInputs': {
                            'url': absolute_uri(reverse('sentry-extensions-vsts-issue-updated')),
                            'resourceDetailsToSend': 'all',
                            'httpHeaders': 'shared-secret:%s' % shared_secret,
                        }
                    },
                )

            integration.metadata['subscription'] = {
                'id': subscription['id'],
                'secret': shared_secret,
            }
            integration.save()
            break
