import re

from sentry import options
from sentry.grouping.component import GroupingComponent
from sentry.grouping.enhancer import LATEST_VERSION, Enhancements, InvalidEnhancerConfig
from sentry.grouping.strategies.base import DEFAULT_GROUPING_ENHANCEMENTS_BASE, GroupingContext
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from sentry.grouping.utils import (
    expand_title_template,
    hash_from_values,
    is_default_fingerprint_var,
    resolve_fingerprint_values,
)
from sentry.grouping.variants import (
    HIERARCHICAL_VARIANTS,
    ChecksumVariant,
    ComponentVariant,
    CustomFingerprintVariant,
    FallbackVariant,
    SaltedComponentVariant,
)
from sentry.utils.safe import get_path

HASH_RE = re.compile(r"^[0-9a-f]{32}$")

# Synthetic exceptions should be marked by the SDK, but
# are also detected here as a fallback
_synthetic_exception_type_re = re.compile(
    r"""
    ^
    (
        EXC_ |
        EXCEPTION_ |
        SIG |
        KERN_ |
        ILL_

    # e.g. "EXC_BAD_ACCESS / 0x00000032"
    ) [A-Z0-9_ /x]+
    $
    """,
    re.X,
)


class GroupingConfigNotFound(LookupError):
    pass


class GroupingConfigLoader:
    """Load a grouping config based on global or project options"""

    cache_prefix: str  # Set in subclasses

    def get_config_dict(self, project):
        return {
            "id": self._get_config_id(project),
            "enhancements": self._get_enhancements(project),
        }

    def _get_enhancements(self, project):
        enhancements = project.get_option("sentry:grouping_enhancements")

        config_id = self._get_config_id(project)
        enhancements_base = CONFIGURATIONS[config_id].enhancements_base

        # Instead of parsing and dumping out config here, we can make a
        # shortcut
        from sentry.utils.cache import cache
        from sentry.utils.hashlib import md5_text

        cache_prefix = self.cache_prefix
        cache_prefix += f"{LATEST_VERSION}:"
        cache_key = cache_prefix + md5_text(f"{enhancements_base}|{enhancements}").hexdigest()
        rv = cache.get(cache_key)
        if rv is not None:
            return rv

        try:
            rv = Enhancements.from_config_string(enhancements, bases=[enhancements_base]).dumps()
        except InvalidEnhancerConfig:
            rv = get_default_enhancements()
        cache.set(cache_key, rv)
        return rv

    def _get_config_id(self, project):
        raise NotImplementedError


class ProjectGroupingConfigLoader(GroupingConfigLoader):

    option_name: str  # Set in subclasses

    def _get_config_id(self, project):
        return project.get_option(
            self.option_name,
            validate=lambda x: x in CONFIGURATIONS,
        )


class PrimaryGroupingConfigLoader(ProjectGroupingConfigLoader):
    """The currently active grouping config"""

    option_name = "sentry:grouping_config"
    cache_prefix = "grouping-enhancements:"


class SecondaryGroupingConfigLoader(ProjectGroupingConfigLoader):
    """Secondary config to find old groups after config change"""

    option_name = "sentry:secondary_grouping_config"
    cache_prefix = "secondary-grouping-enhancements:"


class BackgroundGroupingConfigLoader(GroupingConfigLoader):
    """Does not affect grouping, runs in addition to measure performance impact"""

    cache_prefix = "background-grouping-enhancements:"

    def _get_config_id(self, project):
        return options.get("store.background-grouping-config-id")


def get_grouping_config_dict_for_project(project, silent=True):
    """Fetches all the information necessary for grouping from the project
    settings.  The return value of this is persisted with the event on
    ingestion so that the grouping algorithm can be re-run later.

    This is called early on in normalization so that everything that is needed
    to group the project is pulled into the event.
    """
    loader = PrimaryGroupingConfigLoader()
    return loader.get_config_dict(project)


def get_grouping_config_dict_for_event_data(data, project):
    """Returns the grouping config for an event dictionary."""
    return data.get("grouping_config") or get_grouping_config_dict_for_project(project)


def get_default_enhancements(config_id=None):
    base = DEFAULT_GROUPING_ENHANCEMENTS_BASE
    if config_id is not None:
        base = CONFIGURATIONS[config_id].enhancements_base
    return Enhancements(rules=[], bases=[base]).dumps()


def get_default_grouping_config_dict(id=None):
    """Returns the default grouping config."""
    if id is None:
        from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG

        id = DEFAULT_GROUPING_CONFIG
    return {"id": id, "enhancements": get_default_enhancements(id)}


def load_grouping_config(config_dict=None):
    """Loads the given grouping config."""
    if config_dict is None:
        config_dict = get_default_grouping_config_dict()
    elif "id" not in config_dict:
        raise ValueError("Malformed configuration dictionary")
    config_dict = dict(config_dict)
    config_id = config_dict.pop("id")
    if config_id not in CONFIGURATIONS:
        raise GroupingConfigNotFound(config_id)
    return CONFIGURATIONS[config_id](**config_dict)


def load_default_grouping_config():
    return load_grouping_config(config_dict=None)


def get_fingerprinting_config_for_project(project):
    from sentry.grouping.fingerprinting import FingerprintingRules, InvalidFingerprintingConfig

    rules = project.get_option("sentry:fingerprinting_rules")
    if not rules:
        return FingerprintingRules([])

    from sentry.utils.cache import cache
    from sentry.utils.hashlib import md5_text

    cache_key = "fingerprinting-rules:" + md5_text(rules).hexdigest()
    rv = cache.get(cache_key)
    if rv is not None:
        return FingerprintingRules.from_json(rv)

    try:
        rv = FingerprintingRules.from_config_string(rules)
    except InvalidFingerprintingConfig:
        rv = FingerprintingRules([])
    cache.set(cache_key, rv.to_json())
    return rv


def apply_server_fingerprinting(event, config, allow_custom_title=True):
    client_fingerprint = event.get("fingerprint")
    rv = config.get_fingerprint_values_for_event(event)
    if rv is not None:
        rule, new_fingerprint, attributes = rv

        # A custom title attribute is stored in the event to override the
        # default title.
        if "title" in attributes and allow_custom_title:
            event["title"] = expand_title_template(attributes["title"], event)
        event["fingerprint"] = new_fingerprint

        # Persist the rule that matched with the fingerprint in the event
        # dictionary for later debugging.
        event["_fingerprint_info"] = {
            "client_fingerprint": client_fingerprint,
            "matched_rule": rule.to_json(),
        }


def _get_calculated_grouping_variants_for_event(event, context):
    winning_strategy = None
    precedence_hint = None
    per_variant_components = {}

    for strategy in context.config.iter_strategies():
        rv = strategy.get_grouping_component_variants(event, context=context)
        for (variant, component) in rv.items():
            per_variant_components.setdefault(variant, []).append(component)

            if winning_strategy is None:
                if component.contributes:
                    winning_strategy = strategy.name
                    variants_hint = "/".join(sorted(k for k, v in rv.items() if v.contributes))
                    precedence_hint = "{} take{} precedence".format(
                        f"{strategy.name} of {variants_hint}"
                        if variant != "default"
                        else strategy.name,
                        "" if strategy.name.endswith("s") else "s",
                    )
            elif component.contributes and winning_strategy != strategy.name:
                component.update(
                    contributes=False, contributes_to_similarity=True, hint=precedence_hint
                )

    rv = {}
    for (variant, components) in per_variant_components.items():
        component = GroupingComponent(id=variant, values=components)
        if not component.contributes and precedence_hint:
            component.update(hint=precedence_hint)
        rv[variant] = component

    return rv


def get_grouping_variants_for_event(event, config=None):
    """Returns a dict of all grouping variants for this event."""
    # If a checksum is set the only variant that comes back from this
    # event is the checksum variant.
    checksum = event.data.get("checksum")
    if checksum:
        if HASH_RE.match(checksum):
            return {"checksum": ChecksumVariant(checksum)}

        rv = {
            "hashed-checksum": ChecksumVariant(hash_from_values(checksum), hashed=True),
        }

        # The legacy code path also supported arbitrary values here but
        # it will blow up if it results in more than 32 bytes of data
        # as this cannot be inserted into the database.  (See GroupHash.hash)
        if len(checksum) <= 32:
            rv["checksum"] = ChecksumVariant(checksum)

        return rv

    # Otherwise we go to the various forms of fingerprint handling.  If the event carries
    # a materialized fingerprint info from server side fingerprinting we forward it to the
    # variants which can export additional information about them.
    fingerprint = event.data.get("fingerprint") or ["{{ default }}"]
    fingerprint_info = event.data.get("_fingerprint_info")
    defaults_referenced = sum(1 if is_default_fingerprint_var(d) else 0 for d in fingerprint)

    if config is None:
        config = load_default_grouping_config()
    context = GroupingContext(config)

    # At this point we need to calculate the default event values.  If the
    # fingerprint is salted we will wrap it.
    components = _get_calculated_grouping_variants_for_event(event, context)

    # If no defaults are referenced we produce a single completely custom
    # fingerprint and mark all other variants as non-contributing
    if defaults_referenced == 0:
        rv = {}
        for (key, component) in components.items():
            component.update(
                contributes=False,
                contributes_to_similarity=True,
                hint="custom fingerprint takes precedence",
            )
            rv[key] = ComponentVariant(component, context.config)

        fingerprint = resolve_fingerprint_values(fingerprint, event.data)
        rv["custom-fingerprint"] = CustomFingerprintVariant(fingerprint, fingerprint_info)

    # If the fingerprints are unsalted, we can return them right away.
    elif defaults_referenced == 1 and len(fingerprint) == 1:
        rv = {}
        for (key, component) in components.items():
            rv[key] = ComponentVariant(component, context.config)

    # Otherwise we need to salt each of the components.
    else:
        rv = {}
        fingerprint = resolve_fingerprint_values(fingerprint, event.data)
        for (key, component) in components.items():
            rv[key] = SaltedComponentVariant(
                fingerprint, component, context.config, fingerprint_info
            )

    # Ensure we have a fallback hash if nothing else works out
    if not any(x.contributes for x in rv.values()):
        rv["fallback"] = FallbackVariant()

    return rv


def sort_grouping_variants(variants):
    """Sort a sequence of variants into flat and hierarchical variants"""

    flat_variants = []
    hierarchical_variants = []

    for name, variant in variants.items():

        if name in HIERARCHICAL_VARIANTS:
            hierarchical_variants.append((name, variant))
        else:
            flat_variants.append((name, variant))

    # Sort system variant to the back of the list to resolve ambiguities when
    # choosing primary_hash for Snuba
    flat_variants.sort(key=lambda name_and_variant: 1 if name_and_variant[0] == "system" else 0)
    flat_variants = [variant for name, variant in flat_variants]

    # Sort hierarchical_variants by order defined in HIERARCHICAL_VARIANTS
    hierarchical_variants.sort(
        key=lambda name_and_variant: HIERARCHICAL_VARIANTS.index(name_and_variant[0])
    )
    hierarchical_variants = [variant for name, variant in hierarchical_variants]

    return flat_variants, hierarchical_variants


def detect_synthetic_exception(event_data, grouping_config):
    """Detect synthetic exception and write marker to event data

    This only runs if detect_synthetic_exception_types is True, so
    it is effectively only enabled for grouping strategy mobile:2021-04-02.

    """
    loaded_grouping_config = load_grouping_config(grouping_config)
    should_detect = loaded_grouping_config.initial_context["detect_synthetic_exception_types"]
    if not should_detect:
        return

    for exception in get_path(event_data, "exception", "values", filter=True, default=[]):
        mechanism = get_path(exception, "mechanism")
        # Only detect if undecided:
        if mechanism is not None and mechanism.get("synthetic") is None:
            exception_type = exception.get("type")
            if exception_type and _synthetic_exception_type_re.match(exception_type):
                mechanism["synthetic"] = True
