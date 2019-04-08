from __future__ import absolute_import

import re
import six

from sentry.grouping.strategies.configurations import CONFIGURATIONS, DEFAULT_CONFIG
from sentry.grouping.component import GroupingComponent
from sentry.grouping.variants import ChecksumVariant, FallbackVariant, \
    ComponentVariant, CustomFingerprintVariant, SaltedComponentVariant
from sentry.grouping.utils import DEFAULT_FINGERPRINT_VALUES, hash_from_values


HASH_RE = re.compile(r'^[0-9a-f]{32}$')


class ConfigNotFoundException(LookupError):
    pass


def get_grouping_config_dict_for_project(project, silent=True):
    """Fetches all the information necessary for grouping from the project
    settings.  The return value of this is persisted with the event on
    ingestion so that the grouping algorithm can be re-run later.

    This is called early on in normalization so that everything that is needed
    to group the project is pulled into the event.
    """
    config_id = project.get_option('sentry:grouping_config')
    if config_id is None:
        config_id = DEFAULT_CONFIG
    else:
        try:
            CONFIGURATIONS[config_id]
        except KeyError:
            if not silent:
                raise ConfigNotFoundException(config_id)
            config_id = DEFAULT_CONFIG

    # At a later point we might want to store additional information here
    # such as frames that mark the end of a stacktrace and more.
    return {
        'id': config_id,
    }


def get_default_grouping_config_dict():
    """Returns the default grouping config."""
    return {
        'id': DEFAULT_CONFIG,
    }


def load_grouping_config(config_dict=None):
    """Loads the given grouping config."""
    if config_dict is None:
        config_dict = get_default_grouping_config_dict()
    elif 'id' not in config_dict:
        raise ValueError('Malformed configuration dictionary')
    config_dict = dict(config_dict)
    config_id = config_dict.pop('id')
    if config_id not in CONFIGURATIONS:
        raise ConfigNotFoundException(config_id)
    return CONFIGURATIONS[config_id](**config_dict)


def _get_calculated_grouping_variants_for_event(event, config):
    winning_strategy = None
    precedence_hint = None
    per_variant_components = {}

    for strategy in config.iter_strategies():
        rv = strategy.get_grouping_component_variants(event, config=config)
        for (variant, component) in six.iteritems(rv):
            per_variant_components.setdefault(variant, []).append(component)

            if winning_strategy is None:
                if component.contributes:
                    winning_strategy = strategy.name
                    precedence_hint = '%s takes precedence' % (
                        '%s of %s' % (strategy.name, variant) if
                        variant != 'default' else
                        strategy.name
                    )
            elif component.contributes and winning_strategy != strategy.name:
                component.update(
                    contributes=False,
                    hint=precedence_hint
                )

    rv = {}
    for (variant, components) in six.iteritems(per_variant_components):
        component = GroupingComponent(
            id=variant,
            values=components,
        )
        if not component.contributes and precedence_hint:
            component.update(hint=precedence_hint)
        rv[variant] = component

    return rv


def get_grouping_variants_for_event(event, config=None):
    """Returns a dict of all grouping variants for this event."""
    # If a checksum is set the only variant that comes back from this
    # event is the checksum variant.
    checksum = event.data.get('checksum')
    if checksum:
        if HASH_RE.match(checksum):
            return {
                'checksum': ChecksumVariant(checksum),
            }
        return {
            'checksum': ChecksumVariant(checksum),
            'hashed-checksum': ChecksumVariant(hash_from_values(checksum), hashed=True),
        }

    # Otherwise we go to the various forms of fingerprint handling.
    fingerprint = event.data.get('fingerprint') or ['{{ default }}']
    defaults_referenced = sum(1 if d in DEFAULT_FINGERPRINT_VALUES else 0 for d in fingerprint)

    # If no defaults are referenced we produce a single completely custom
    # fingerprint.
    if defaults_referenced == 0:
        return {
            'custom-fingerprint': CustomFingerprintVariant(fingerprint),
        }

    # At this point we need to calculate the default event values.  If the
    # fingerprint is salted we will wrap it.
    config = load_grouping_config(config)
    components = _get_calculated_grouping_variants_for_event(event, config)
    rv = {}

    # If the fingerprints are unsalted, we can return them right away.
    if defaults_referenced == 1 and len(fingerprint) == 1:
        for (key, component) in six.iteritems(components):
            rv[key] = ComponentVariant(component, config)

    # Otherwise we need to salt each of the components.
    else:
        for (key, component) in six.iteritems(components):
            rv[key] = SaltedComponentVariant(fingerprint, component, config)

    # Ensure we have a fallback hash if nothing else works out
    if not any(x.contributes for x in six.itervalues(rv)):
        rv['fallback'] = FallbackVariant()

    return rv
