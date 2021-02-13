NATIVE_PLATFORMS = frozenset(("objc", "cocoa", "swift", "native", "c"))
JAVASCRIPT_PLATFORMS = frozenset(("javascript", "node"))
JAVA_PLATFORMS = frozenset(("java", "groovy"))


def get_behavior_family_for_platform(platform):
    if platform in JAVASCRIPT_PLATFORMS:
        return "javascript"
    if platform in JAVA_PLATFORMS:
        return "java"
    if platform in NATIVE_PLATFORMS:
        return "native"
    return "other"
