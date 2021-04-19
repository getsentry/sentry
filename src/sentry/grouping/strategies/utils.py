from sentry.grouping.variants import HIERARCHICAL_VARIANTS


def remove_non_stacktrace_variants(variants):
    """This is a utility function that when given multiple variants will
    mark all variants as non contributing that do not contain any stacktraces
    if any of the other variants contain a stacktrace that contributes.
    """
    if len(variants) <= 1:
        return variants
    any_stacktrace_contributes = False
    non_contributing_components = []
    stacktrace_variants = set()

    # In case any of the variants has a contributing stacktrace, we want
    # to make all other variants non contributing.
    for key, component in variants.items():
        stacktrace_iter = component.iter_subcomponents(
            id="stacktrace", recursive=True, only_contributing=True
        )
        if next(stacktrace_iter, None) is not None:
            any_stacktrace_contributes = True
            stacktrace_variants.add(key)
        elif key not in HIERARCHICAL_VARIANTS:
            non_contributing_components.append(component)

    if any_stacktrace_contributes:
        if len(stacktrace_variants) == 1:
            hint_suffix = "the %s variant does" % next(iter(stacktrace_variants))
        else:
            # this branch is basically dead because we only have two
            # variants right now, but this is so this does not break in
            # the future.
            hint_suffix = "others do"
        for component in non_contributing_components:
            component.update(
                contributes=False,
                hint="ignored because this variant does not have a contributing "
                "stacktrace, but %s" % hint_suffix,
            )

    return variants


def has_url_origin(path, allow_file_origin=False):
    # URLs can be generated such that they are:
    #   blob:http://example.com/7f7aaadf-a006-4217-9ed5-5fbf8585c6c0
    # https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL
    if not path:
        return False
    if path.startswith(("http:", "https:", "applewebdata:", "blob:")):
        return True
    if path.startswith("file:"):
        return not allow_file_origin
    return False
