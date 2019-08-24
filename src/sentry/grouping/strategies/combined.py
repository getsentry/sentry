# coding: utf-8
from __future__ import absolute_import

from sentry.grouping.strategies.base import strategy, lookup_strategy
from sentry.stacktraces.platform import get_behavior_family_for_platform


def dispatch_strategy(id, targets, score=None):
    interfaces = None
    variants = None
    has_variant_processor = False
    selectors = []

    for target, selector in targets:
        s = lookup_strategy(target)
        selectors.append((s, selector))
        if interfaces is None:
            interfaces = s.interfaces
        if variants is None:
            variants = s.variants
        if score is None:
            score = s.score
        if s.variant_processor_func is not None:
            has_variant_processor = True

    @strategy(id=id, interfaces=interfaces, variants=variants, score=score)
    def main_strategy(_interface, **meta):
        for s, selector in selectors:
            if selector(_interface, **meta):
                return s(_interface, **meta)

    if has_variant_processor:

        @main_strategy.variant_processor
        def variant_processor(variants, **meta):
            for s, selector in selectors:
                if selector(None, **meta):
                    if s.variant_processor_func is None:
                        return variants
                    return s.variant_processor_func(variants, **meta)
            return variants

    return main_strategy


def is_native(meta):
    return get_behavior_family_for_platform(meta["event"].platform) == "native"


stacktrace_v1nl = dispatch_strategy(
    id="stacktrace:v1nl",
    targets=[
        ("stacktrace:v1", lambda stacktrace, **meta: is_native(meta)),
        ("stacktrace:legacy", lambda stacktrace, **meta: True),
    ],
)

frame_v1nl = dispatch_strategy(
    id="frame:v1nl",
    targets=[
        ("frame:v1", lambda stacktrace, **meta: is_native(meta)),
        ("frame:legacy", lambda stacktrace, **meta: True),
    ],
)

single_exception_v1nl = dispatch_strategy(
    id="single-exception:v1nl",
    targets=[
        ("single-exception:v1", lambda exception, **meta: is_native(meta)),
        ("single-exception:legacy", lambda exception, **meta: True),
    ],
)

chained_exception_v1nl = dispatch_strategy(
    id="chained-exception:v1nl",
    targets=[
        ("chained-exception:v1", lambda chained_exception, **meta: is_native(meta)),
        ("chained-exception:legacy", lambda chained_exception, **meta: True),
    ],
)
