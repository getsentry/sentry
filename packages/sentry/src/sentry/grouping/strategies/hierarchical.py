from typing import Iterable, Optional

from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import ReturnedVariants

MAX_LAYERS = 5


def get_stacktrace_hierarchy(
    main_variant, components, frames, inverted_hierarchy
) -> ReturnedVariants:
    frames_iter = list(zip(frames, components))
    if not inverted_hierarchy:
        # frames are sorted in a way where the crashing frame is at the end of
        # the list. In "non-inverted" mode we want to start at the crashing
        # frame, in inverted mode we want to start at the threadbase
        frames_iter = reversed(frames_iter)

    frames_iter = iter(frames_iter)

    prev_variant = GroupingComponent(id="stacktrace", values=[])
    all_variants = {}

    while len(all_variants) < MAX_LAYERS:
        depth = len(all_variants) + 1
        key = f"app-depth-{depth}"
        assert key not in all_variants

        found_sentinel = False

        for frame, component in frames_iter:
            if not component.contributes:
                continue

            # We found a sentinel frame, which somebody decided was important
            # to group by. In that case we group only by sentinel frames as we
            # can't be sure that in-app is a good indicator of relevance.

            if component.is_sentinel_frame:
                found_sentinel = True
                break

            # In case we found an application frame before the first sentinel
            # frame, use the "fallback logic". Sentinel frames are mostly
            # useful to identify important frames *called by* app frames that
            # would otherwise be discarded from grouping (in case of ANR
            # grouping/inverted_hierarchy similar reasoning applies)

            if frame["in_app"]:
                break

        if not found_sentinel:
            break

        add_to_layer = [component]

        prev_component = component

        if prev_component.is_prefix_frame:
            for frame, component in frames_iter:
                if not component.contributes:
                    continue

                add_to_layer.append(component)
                prev_component = component

                if not component.is_prefix_frame:
                    break

        # For consistency, we always want to preserve the sort order of the
        # event frames, no matter what order we're going through.

        if not inverted_hierarchy:
            layer = add_to_layer
            layer.reverse()
            layer.extend(prev_variant.values)

        else:
            layer = list(prev_variant.values)
            layer.extend(add_to_layer)

        tree_label = _compute_tree_label(layer)

        all_variants[key] = prev_variant = GroupingComponent(
            id="stacktrace", values=layer, tree_label=tree_label
        )

    if not all_variants:
        # In case we haven't found any sentinel frames, start grouping by
        # application frames.
        all_variants = _build_fallback_tree(main_variant, components, frames, inverted_hierarchy)
    else:
        all_variants["app-depth-max"] = main_variant

    main_variant.update(tree_label=_compute_tree_label(main_variant.values))

    return all_variants


def _compute_tree_label(components: Iterable[GroupingComponent]):
    tree_label = []

    for frame in components:
        if frame.contributes and frame.tree_label:
            lbl = dict(frame.tree_label)
            if frame.is_sentinel_frame:
                lbl["is_sentinel"] = True
            if frame.is_prefix_frame:
                lbl["is_prefix"] = True

            tree_label.append(lbl)

    # We assume all components are always sorted in the way frames appear in
    # the event (threadbase -> crashing frame). Then we want to show the
    # crashing frame/culprit at the front.
    tree_label.reverse()
    return tree_label


def _build_fallback_tree(main_variant, components, frames, inverted_hierarchy):
    blaming_frame_idx = None
    for idx, (component, frame) in enumerate(zip(components, frames)):
        if component.contributes and frame["in_app"]:
            blaming_frame_idx = idx
            if inverted_hierarchy:
                break

    if blaming_frame_idx is None:
        for idx, (component, frame) in enumerate(zip(components, frames)):
            if component.contributes and not component.is_prefix_frame:
                blaming_frame_idx = idx
                if inverted_hierarchy:
                    break

    if blaming_frame_idx is None:
        for idx, (component, frame) in enumerate(zip(components, frames)):
            if component.contributes:
                blaming_frame_idx = idx
                if inverted_hierarchy:
                    break

    if blaming_frame_idx is None:
        blaming_frame_idx = len(components) - 1 if not inverted_hierarchy else 0

    blaming_frame_component = components[blaming_frame_idx]

    # If the blaming frame is in-app, only add in-app frames going forward
    # (otherwise add any frame).
    #
    # This cuts away a lot of noise from tree_labels, and for e.g. Android ANRs
    # it still kind of works since either we find the view's onCreate function,
    # or some sentinel frame first.
    needs_in_app = frames[blaming_frame_idx]["in_app"]

    prev_variant = GroupingComponent(id="stacktrace", values=[])
    all_variants = {}

    def _assemble_level(depth):
        pre_frames = _accumulate_frame_levels(
            frames, components, blaming_frame_idx, depth, -1, needs_in_app
        )
        post_frames = _accumulate_frame_levels(
            frames, components, blaming_frame_idx, depth, 1, needs_in_app
        )

        rv = pre_frames
        rv.reverse()
        rv.append(blaming_frame_component)
        rv.extend(post_frames)
        return rv

    while len(all_variants) < MAX_LAYERS:
        depth = len(all_variants) + 1
        key = f"app-depth-{depth}"
        assert key not in all_variants
        level_frames = _assemble_level(depth)

        if len(prev_variant.values) == len(level_frames):
            break

        tree_label = _compute_tree_label(level_frames)

        all_variants[key] = prev_variant = GroupingComponent(
            id="stacktrace",
            values=level_frames,
            tree_label=tree_label,
        )

    level_frames = _assemble_level(None)
    tree_label = _compute_tree_label(level_frames)

    all_variants["app-depth-max"] = GroupingComponent(
        id="stacktrace", values=level_frames, tree_label=tree_label
    )

    return all_variants


def _accumulate_frame_levels(
    frames, values, blaming_frame_idx, depth: Optional[int], direction, needs_in_app
):
    rv = []

    # subtract depth by one to count blaming frame
    if depth is not None:
        depth -= 1

    added = 0
    prev_was_prefix = values[blaming_frame_idx].is_prefix_frame
    idx = blaming_frame_idx + direction

    while 0 <= idx < len(values):
        component = values[idx]
        frame = frames[idx]
        idx += direction

        if not component.contributes:
            continue

        if needs_in_app and not frame["in_app"]:
            # XXX: At this and any other break/continue we should actually add
            # a non-contributing component to the tree, but that'd involve a
            # deepcopy and people can debug grouping via the system component
            # anyway.
            continue

        if prev_was_prefix:
            rv.append(component)
        else:
            if depth is not None and added == depth:
                break
            rv.append(component)
            added += 1

        prev_was_prefix = component.is_prefix_frame

    return rv
