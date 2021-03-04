NATIVE_PLATFORMS = frozenset(("objc", "cocoa", "swift", "native", "c"))
JAVASCRIPT_PLATFORMS = frozenset(("javascript", "node"))


def get_behavior_family_for_platform(platform):
    if platform in NATIVE_PLATFORMS:
        return "native"
    if platform in JAVASCRIPT_PLATFORMS:
        return "javascript"
    return "other"
