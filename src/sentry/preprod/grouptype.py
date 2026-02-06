from __future__ import annotations

from dataclasses import dataclass

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.types.group import PriorityLevel


@dataclass(frozen=True)
class PreprodStaticGroupType(GroupType):
    """
    Issues detected in a single uploaded artifact. For example an
    Android app not being 16kb page size ready.
    Typically these end up grouped across multiple builds e.g. if CI
    uploads a build of an app for each commit to main each of those
    uploads could result in an occurrence of some issue like the 16kb
    page size.
    """

    type_id = 11001
    slug = "preprod_static"
    description = "Static Analysis"
    category = GroupCategory.PREPROD.value
    category_v2 = GroupCategory.PREPROD.value
    default_priority = PriorityLevel.LOW
    released = False
    enable_auto_resolve = True
    enable_escalation_detection = False


@dataclass(frozen=True)
class PreprodDeltaGroupType(GroupType):
    """
    Issues detected examining the delta between two uploaded artifacts.
    For example a binary size regression. These are typically *not*
    grouped. A size regression between v1 and v2 likely does not have
    the same root cause (and hence resolution) as another regression
    between v2 and v3.
    """

    type_id = 11002
    slug = "preprod_delta"
    description = "Static Analysis Delta"
    category = GroupCategory.PREPROD.value
    category_v2 = GroupCategory.PREPROD.value
    default_priority = PriorityLevel.LOW
    released = False
    enable_auto_resolve = True
    enable_escalation_detection = False
