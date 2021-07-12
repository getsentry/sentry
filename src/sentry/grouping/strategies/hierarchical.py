from typing import Iterable

from sentry.grouping.component import GroupingComponent

MAX_LAYERS = 5


def get_stacktrace_hierarchy(main_variant, components, frames, inverted_hierarchy):
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

        for frame, component in frames_iter:
            if component.contributes and component.is_sentinel_frame:
                break
        else:
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
            else:
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
        all_variants = _build_fallback_tree(main_variant, components, frames, inverted_hierarchy)

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

    prev_variant = GroupingComponent(id="stacktrace", values=[])
    all_variants = {}

    while len(all_variants) < MAX_LAYERS:
        depth = len(all_variants) + 1
        key = f"app-depth-{depth}"
        assert key not in all_variants
        pre_frames = _accumulate_frame_levels(components, blaming_frame_idx, depth, -1)
        post_frames = _accumulate_frame_levels(components, blaming_frame_idx, depth, 1)

        frames = pre_frames
        frames.reverse()
        frames.append(blaming_frame_component)
        frames.extend(post_frames)

        if len(prev_variant.values) == len(frames):
            break

        tree_label = _compute_tree_label(frames)

        all_variants[key] = prev_variant = GroupingComponent(
            id="stacktrace",
            values=pre_frames,
            tree_label=tree_label,
        )

    return all_variants


def _accumulate_frame_levels(values, blaming_frame_idx, depth, direction):
    rv = []

    # subtract depth by one to count blaming frame
    depth -= 1

    idx = blaming_frame_idx + direction
    while 0 <= idx < len(values) and depth > 0:
        component = values[idx]
        idx += direction

        if not component.contributes:
            continue

        rv.append(component)
        if not component.is_prefix_frame:
            depth -= 1

    return rv
