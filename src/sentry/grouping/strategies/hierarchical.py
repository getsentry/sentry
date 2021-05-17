from sentry.grouping.component import GroupingComponent
from sentry.utils.safe import get_path

MAX_LAYERS = 5


def get_stacktrace_hierarchy(main_variant, components, frames, inverted_hierarchy):
    main_variant.update(tree_label="<entire stacktrace>")

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

        tree_categories = set()

        for frame, component in frames_iter:
            if component.contributes and component.is_sentinel_frame:
                break
        else:
            break

        layer = list(prev_variant.values)
        layer.append(component)
        tree_categories.add(get_path(frame, "data", "category") or None)
        prev_component = component

        if prev_component.is_prefix_frame:
            for frame, component in frames_iter:
                if not component.contributes:
                    continue

                layer.append(component)
                tree_categories.add(get_path(frame, "data", "category") or None)
                prev_component = component

                if not component.is_prefix_frame:
                    break
            else:
                break

        tree_label = _compute_tree_label(prev_variant, layer)
        tree_categories.discard(None)
        if tree_categories:
            tree_label = f"{tree_label} [{'/'.join(sorted(tree_categories))}]"

        all_variants[key] = prev_variant = GroupingComponent(
            id="stacktrace", values=layer, tree_label=tree_label
        )

    if not all_variants:
        all_variants.update(
            _build_fallback_tree(main_variant, components, frames, inverted_hierarchy)
        )

    all_variants["app-depth-max"] = main_variant

    return all_variants


def _compute_tree_label(prev_variant, components):
    tree_label = []
    prev_i = 0

    for frame in components:
        if prev_i < len(prev_variant.values) and frame is prev_variant.values[prev_i]:
            if not tree_label or tree_label[-1] != "...":
                tree_label.append("...")
            prev_i += 1
        elif frame.tree_label:
            tree_label.append(frame.tree_label)

    return " | ".join(tree_label)


def _build_fallback_tree(main_variant, components, frames, inverted_hierarchy):
    blaming_frame_idx = None
    for idx, (component, frame) in enumerate(zip(components, frames)):
        if component.contributes and frame["in_app"]:
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

        tree_label = _compute_tree_label(prev_variant, frames)

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
