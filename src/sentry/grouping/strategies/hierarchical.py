from sentry.grouping.component import GroupingComponent


def get_stacktrace_hierarchy(main_variant, components, frames, inverted_hierarchy):
    return _build_fallback_tree(main_variant, components, frames, inverted_hierarchy)


def _build_fallback_tree(main_variant, components, frames, inverted_hierarchy):
    main_variant.update(tree_label="<entire stacktrace>")

    blaming_frame_idx = None
    for idx, (component, frame) in enumerate(zip(components, frames)):
        if component.contributes and frame["in_app"]:
            blaming_frame_idx = idx
            # For Android ANR (inverted_hierarchy=True), we take the outermost
            # app frame as level 1, else the innermost one (closer to crashing
            # frame)
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

    while len(all_variants) < 5:
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
            all_variants[key] = main_variant
            break

        tree_label = []
        prev_i = 0

        for frame in frames:
            if prev_i < len(prev_variant.values) and frame is prev_variant.values[prev_i]:
                if not tree_label or tree_label[-1] != "...":
                    tree_label.append("...")
                prev_i += 1
            elif frame.tree_label:
                tree_label.append(frame.tree_label)

        all_variants[key] = prev_variant = GroupingComponent(
            id="stacktrace",
            values=pre_frames,
            tree_label=" | ".join(tree_label),
        )

    else:
        all_variants["app-depth-max"] = main_variant

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
