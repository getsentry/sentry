from __future__ import annotations

import re
from collections.abc import MutableMapping, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, NotRequired, TypedDict

import sentry_sdk

from sentry import options
from sentry.db.models.fields.node import NodeData
from sentry.grouping.component import (
    AppGroupingComponent,
    BaseGroupingComponent,
    DefaultGroupingComponent,
    SystemGroupingComponent,
)
from sentry.grouping.enhancer import LATEST_VERSION, Enhancements
from sentry.grouping.enhancer.exceptions import InvalidEnhancerConfig
from sentry.grouping.strategies.base import DEFAULT_GROUPING_ENHANCEMENTS_BASE, GroupingContext
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from sentry.grouping.utils import (
    expand_title_template,
    get_fingerprint_type,
    hash_from_values,
    is_default_fingerprint_var,
    resolve_fingerprint_values,
)
from sentry.grouping.variants import (
    BaseVariant,
    BuiltInFingerprintVariant,
    ChecksumVariant,
    ComponentVariant,
    CustomFingerprintVariant,
    FallbackVariant,
    HashedChecksumVariant,
    SaltedComponentVariant,
)
from sentry.models.grouphash import GroupHash

if TYPE_CHECKING:
    from sentry.eventstore.models import Event
    from sentry.grouping.fingerprinting import FingerprintingRules, FingerprintRuleJSON
    from sentry.grouping.strategies.base import StrategyConfiguration
    from sentry.models.project import Project

HASH_RE = re.compile(r"^[0-9a-f]{32}$")


class FingerprintInfo(TypedDict):
    client_fingerprint: NotRequired[list[str]]
    matched_rule: NotRequired[FingerprintRuleJSON]


@dataclass
class GroupHashInfo:
    config: GroupingConfig
    variants: dict[str, BaseVariant]
    hashes: list[str]
    grouphashes: list[GroupHash]
    existing_grouphash: GroupHash | None


NULL_GROUPING_CONFIG: GroupingConfig = {"id": "", "enhancements": ""}
NULL_GROUPHASH_INFO = GroupHashInfo(NULL_GROUPING_CONFIG, {}, [], [], None)


class GroupingConfigNotFound(LookupError):
    pass


class GroupingConfig(TypedDict):
    id: str
    enhancements: str


class GroupingConfigLoader:
    """Load a grouping config based on global or project options"""

    cache_prefix: str  # Set in subclasses

    def get_config_dict(self, project: Project) -> GroupingConfig:
        return {
            "id": self._get_config_id(project),
            "enhancements": self._get_enhancements(project),
        }

    def _get_enhancements(self, project: Project) -> str:
        project_enhancements = project.get_option("sentry:grouping_enhancements")

        config_id = self._get_config_id(project)
        enhancements_base = CONFIGURATIONS[config_id].enhancements_base

        # Instead of parsing and dumping out config here, we can make a
        # shortcut
        from sentry.utils.cache import cache
        from sentry.utils.hashlib import md5_text

        cache_prefix = self.cache_prefix
        cache_prefix += f"{LATEST_VERSION}:"
        cache_key = (
            cache_prefix + md5_text(f"{enhancements_base}|{project_enhancements}").hexdigest()
        )
        enhancements = cache.get(cache_key)
        if enhancements is not None:
            return enhancements

        try:
            enhancements = Enhancements.from_config_string(
                project_enhancements, bases=[enhancements_base]
            ).dumps()
        except InvalidEnhancerConfig:
            enhancements = get_default_enhancements()
        cache.set(cache_key, enhancements)
        return enhancements

    def _get_config_id(self, project: Project) -> str:
        raise NotImplementedError


class ProjectGroupingConfigLoader(GroupingConfigLoader):
    option_name: str  # Set in subclasses

    def _get_config_id(self, project: Project) -> str:
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

    def _get_config_id(self, _project: Project) -> str:
        return options.get("store.background-grouping-config-id")


@sentry_sdk.tracing.trace
def get_grouping_config_dict_for_project(project: Project) -> GroupingConfig:
    """Fetches all the information necessary for grouping from the project
    settings.  The return value of this is persisted with the event on
    ingestion so that the grouping algorithm can be re-run later.

    This is called early on in normalization so that everything that is needed
    to group the event is pulled into the event data.
    """
    loader = PrimaryGroupingConfigLoader()
    return loader.get_config_dict(project)


def get_grouping_config_dict_for_event_data(data: NodeData, project: Project) -> GroupingConfig:
    """Returns the grouping config for an event dictionary."""
    return data.get("grouping_config") or get_grouping_config_dict_for_project(project)


def get_default_enhancements(config_id: str | None = None) -> str:
    base: str | None = DEFAULT_GROUPING_ENHANCEMENTS_BASE
    if config_id is not None:
        base = CONFIGURATIONS[config_id].enhancements_base
    return Enhancements.from_config_string("", bases=[base]).dumps()


def get_projects_default_fingerprinting_bases(
    project: Project, config_id: str | None = None
) -> Sequence[str] | None:
    """Returns the default built-in fingerprinting bases (i.e. sets of rules) for a project."""
    from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG

    config_id = (
        config_id
        # TODO: add fingerprinting config to GroupingConfigLoader and use that here
        or PrimaryGroupingConfigLoader()._get_config_id(project)
        or DEFAULT_GROUPING_CONFIG
    )

    bases = CONFIGURATIONS[config_id].fingerprinting_bases
    return bases


def get_default_grouping_config_dict(config_id: str | None = None) -> GroupingConfig:
    """Returns the default grouping config."""
    if config_id is None:
        from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG

        config_id = DEFAULT_GROUPING_CONFIG
    return {"id": config_id, "enhancements": get_default_enhancements(config_id)}


def load_grouping_config(config_dict: GroupingConfig | None = None) -> StrategyConfiguration:
    """Loads the given grouping config."""
    if config_dict is None:
        config_dict = get_default_grouping_config_dict()
    elif "id" not in config_dict:
        raise ValueError("Malformed configuration dictionary")
    config_id = config_dict["id"]
    if config_id not in CONFIGURATIONS:
        raise GroupingConfigNotFound(config_id)
    return CONFIGURATIONS[config_id](enhancements=config_dict["enhancements"])


def load_default_grouping_config() -> StrategyConfiguration:
    return load_grouping_config(config_dict=None)


def get_fingerprinting_config_for_project(
    project: Project, config_id: str | None = None
) -> FingerprintingRules:
    """
    Returns the fingerprinting rules for a project.
    Merges the project's custom fingerprinting rules (if any) with the default built-in rules.
    """

    from sentry.grouping.fingerprinting import FingerprintingRules, InvalidFingerprintingConfig

    bases = get_projects_default_fingerprinting_bases(project, config_id=config_id)
    raw_rules = project.get_option("sentry:fingerprinting_rules")
    if not raw_rules:
        return FingerprintingRules([], bases=bases)

    from sentry.utils.cache import cache
    from sentry.utils.hashlib import md5_text

    cache_key = "fingerprinting-rules:" + md5_text(raw_rules).hexdigest()
    config_json = cache.get(cache_key)
    if config_json is not None:
        return FingerprintingRules.from_json(config_json, bases=bases)

    try:
        rules = FingerprintingRules.from_config_string(raw_rules, bases=bases)
    except InvalidFingerprintingConfig:
        rules = FingerprintingRules([], bases=bases)
    cache.set(cache_key, rules.to_json())
    return rules


def apply_server_fingerprinting(
    event: MutableMapping[str, Any], fingerprinting_config: FingerprintingRules
) -> None:
    fingerprint_info = {}

    client_fingerprint = event.get("fingerprint", [])
    client_fingerprint_is_default = len(client_fingerprint) == 1 and is_default_fingerprint_var(
        client_fingerprint[0]
    )
    if client_fingerprint and not client_fingerprint_is_default:
        fingerprint_info["client_fingerprint"] = client_fingerprint

    fingerprint_match = fingerprinting_config.get_fingerprint_values_for_event(event)
    if fingerprint_match is not None:
        matched_rule, new_fingerprint, attributes = fingerprint_match

        # A custom title attribute is stored in the event to override the
        # default title.
        if "title" in attributes:
            event["title"] = expand_title_template(attributes["title"], event)
        event["fingerprint"] = new_fingerprint

        # Persist the rule that matched with the fingerprint in the event
        # dictionary for later debugging.
        fingerprint_info["matched_rule"] = matched_rule.to_json()

    if fingerprint_info:
        event["_fingerprint_info"] = fingerprint_info


def _get_variants_from_strategies(
    event: Event, context: GroupingContext
) -> dict[str, ComponentVariant]:
    winning_strategy: str | None = None
    precedence_hint: str | None = None
    all_strategies_components_by_variant: dict[str, list[BaseGroupingComponent[Any]]] = {}

    # `iter_strategies` presents strategies in priority order, which allows us to go with the first
    # one which produces a result. (See `src/sentry/grouping/strategies/configurations.py` for the
    # strategies used by each config.)
    for strategy in context.config.iter_strategies():
        current_strategy_components_by_variant = strategy.get_grouping_components(
            event, context=context
        )
        for variant_name, component in current_strategy_components_by_variant.items():
            all_strategies_components_by_variant.setdefault(variant_name, []).append(component)

            if component.contributes:
                # If we haven't yet found a winner.. now we have! Keep track of which strategy won
                # so we can add hints to the others indicating what took precedence
                if winning_strategy is None:
                    winning_strategy = strategy.name
                    variant_descriptor = "/".join(
                        sorted(
                            variant_name
                            for variant_name, component in current_strategy_components_by_variant.items()
                            if component.contributes
                        )
                    )
                    precedence_hint = "{} take{} precedence".format(
                        (
                            f"{strategy.name} of {variant_descriptor}"
                            if variant_name != "default"
                            else strategy.name
                        ),
                        "" if strategy.name.endswith("s") else "s",
                    )
                # On the other hand, if another strategy before this one was already the winner, we
                # don't want any of this strategy's components to contribute to grouping
                elif strategy.name != winning_strategy:
                    component.update(contributes=False, hint=precedence_hint)

    variants = {}

    for variant_name, components in all_strategies_components_by_variant.items():
        component_class_by_variant = {
            "app": AppGroupingComponent,
            "default": DefaultGroupingComponent,
            "system": SystemGroupingComponent,
        }
        root_component = component_class_by_variant[variant_name](values=components)

        # The root component will pull its `contributes` value from the components it wraps - if
        # none of them contributes, it will also be marked as non-contributing. But those components
        # might not have the same reasons for not contributing (`hint` values), so it can't pull
        # that them - it's gotta be set here.
        if not root_component.contributes and precedence_hint:
            root_component.update(hint=precedence_hint)

        variants[variant_name] = ComponentVariant(
            component=root_component,
            strategy_config=context.config,
        )

    return variants


# This is called by the Event model in get_grouping_variants()
def get_grouping_variants_for_event(
    event: Event, config: StrategyConfiguration | None = None
) -> dict[str, BaseVariant]:
    """Returns a dict of all grouping variants for this event."""
    # If a checksum is set the only variant that comes back from this event is the checksum variant.
    #
    # TODO: Is there a reason we don't treat a checksum like a custom fingerprint, and run the other
    # strategies but mark them as non-contributing, with explanations why?
    checksum = event.data.get("checksum")
    if checksum:
        if HASH_RE.match(checksum):
            return {"checksum": ChecksumVariant(checksum)}
        else:
            return {
                "hashed_checksum": HashedChecksumVariant(hash_from_values(checksum), checksum),
            }

    # Otherwise we go to the various forms of grouping based on fingerprints and/or event data
    # (stacktrace, message, etc.)
    raw_fingerprint = event.data.get("fingerprint") or ["{{ default }}"]
    fingerprint_info = event.data.get("_fingerprint_info", {})
    fingerprint_type = get_fingerprint_type(raw_fingerprint)
    resolved_fingerprint = (
        raw_fingerprint
        if fingerprint_type == "default"
        else resolve_fingerprint_values(raw_fingerprint, event.data)
    )

    # Run all of the event-data-based grouping strategies. Any which apply will create grouping
    # components, which will then be grouped into variants by variant type (system, app, default).
    context = GroupingContext(config or load_default_grouping_config())
    strategy_component_variants: dict[str, ComponentVariant] = _get_variants_from_strategies(
        event, context
    )

    # Create a separate container for these for now to preserve the typing of
    # `strategy_component_variants`
    additional_variants: dict[str, BaseVariant] = {}

    # If the fingerprint is the default fingerprint, we can use the variants as is. If it's custom,
    # we need to create an addiional fingerprint variant and mark the existing variants as
    # non-contributing. And if it's hybrid, we'll replace the existing variants with "salted"
    # versions which include the fingerprint.
    if fingerprint_type == "custom":
        for variant in strategy_component_variants.values():
            variant.component.update(contributes=False, hint="custom fingerprint takes precedence")

        if fingerprint_info.get("matched_rule", {}).get("is_builtin") is True:
            additional_variants["built_in_fingerprint"] = BuiltInFingerprintVariant(
                resolved_fingerprint, fingerprint_info
            )
        else:
            additional_variants["custom_fingerprint"] = CustomFingerprintVariant(
                resolved_fingerprint, fingerprint_info
            )
    elif fingerprint_type == "hybrid":
        for variant_name, variant in strategy_component_variants.items():
            # Since we're reusing the variant names, when all of the variants are combined, these
            # salted versions will replace the unsalted versions
            additional_variants[variant_name] = SaltedComponentVariant.from_component_variant(
                variant, resolved_fingerprint, fingerprint_info
            )

    final_variants = {
        **strategy_component_variants,
        # Add these in second, so the salted versions of any variants replace the unsalted versions
        **additional_variants,
    }

    # Ensure we have a fallback hash if nothing else works out
    if not any(x.contributes for x in final_variants.values()):
        final_variants["fallback"] = FallbackVariant()

    return final_variants
