from __future__ import absolute_import

import re
import six
import uuid
import json

from datetime import datetime
from pytz import utc

from sentry.models import ProjectKey, OrganizationOption


def _generate_pii_config(project, org_options):
    scrub_ip_address = (org_options.get('sentry:require_scrub_ip_address', False) or
                        project.get_option('sentry:scrub_ip_address', False))
    scrub_data = (org_options.get('sentry:require_scrub_data', False) or
                  project.get_option('sentry:scrub_data', True))
    fields = project.get_option('sentry:sensitive_fields')

    if not scrub_data and not scrub_ip_address:
        return None

    custom_rules = {}

    default_rules = []
    ip_rules = []
    databag_rules = []

    if scrub_data:
        default_rules.extend((
            '@email',
            '@mac',
            '@creditcard',
            '@userpath',
        ))
        databag_rules.append('@password')
        if fields:
            custom_rules['strip-fields'] = {
                'type': 'redactPair',
                'redaction': 'remove',
                'keyPattern': r'\b%s\n' % '|'.join(re.escape(x) for x in fields),
            }
            databag_rules.push('strip-fields')

    if scrub_ip_address:
        ip_rules.push('@ip')

    return {
        'rules': custom_rules,
        'applications': {
            'freeform': default_rules,
            'databag': default_rules + databag_rules,
            'username': scrub_data and ['@userpath'] or [],
            'email': scrub_data and ['@email'] or [],
            'ip': ip_rules,
        }
    }


def get_pii_config(project, org_options):
    value = project.get_option('sentry:relay_pii_config')
    if value is not None:
        try:
            return json.loads(value)
        except (TypeError, ValueError):
            return None
    return _generate_pii_config(project, org_options)


def get_project_options(project):
    """Returns a dict containing the config for a project for the sentry relay"""
    project_keys = ProjectKey.objects.filter(
        project=project,
    ).all()

    public_keys = {}
    for project_key in list(project_keys):
        public_keys[project_key.public_key] = project_key.status == 0

    now = datetime.utcnow().replace(tzinfo=utc)

    org_options = OrganizationOption.objects.get_all_values(
        project.organization_id)

    rv = {
        'disabled': project.status > 0,
        'slug': project.slug,
        'lastFetch': now,
        'lastChange': project.get_option('sentry:relay-rev-lastchange', now),
        'rev': project.get_option('sentry:relay-rev', uuid.uuid4().hex),
        'publicKeys': public_keys,
        'config': {
            'allowedDomains': project.get_option('sentry:origins', ['*']),
            'trustedRelays': org_options.get('sentry:trusted-relays', []),
            'piiConfig': get_pii_config(project, org_options),
        },
    }
    return rv


def relay_has_org_access(relay, org):
    # Internal relays always have access
    if relay.is_internal:
        return True
    # Use the normalized form of the public key for the check
    return six.text_type(relay.public_key_object) \
        in org.get_option('sentry:trusted-relays', [])


def get_project_key_config(project_key):
    """Returns a dict containing the information for a specific project key"""
    return {
        'dsn': project_key.dsn_public,
    }
