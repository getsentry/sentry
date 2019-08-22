from __future__ import absolute_import


def get_behavior_family_for_platform(platform):
    if platform in ("objc", "cocoa", "swift", "native", "c"):
        return "native"
    if platform in ("javascript", "node"):
        return "javascript"
    return "other"
