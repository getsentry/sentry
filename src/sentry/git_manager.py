import re
from uuid import uuid4

BRANCH_NAME_REGEX = r"[^\w +]"


def get_group_type(group):
    event_metadata = group.get_event_metadata()
    event_type = group.get_event_type()
    has_group_type = event_type == "error" and "type" in event_metadata
    return event_metadata["type"] if has_group_type else None


def parse_group_type(group):
    group_type = get_group_type(group)
    if not group_type:
        return ""

    group_type = re.sub(BRANCH_NAME_REGEX, "", group_type)
    group_type = group_type.strip().lower().replace(" ", "-")
    return group_type[:50]


def build_branch_name(branch_format, group):
    uuid = uuid4().hex[:8]
    keywords = {
        "[issueId]": f"FIXES-{group.qualified_short_id}",
        "[issueType]": parse_group_type(group),
        "[orgSlug]": group.project.organization.slug,
    }

    branch_name = branch_format
    for key, value in keywords.items():
        branch_name = branch_name.replace(key, value)
    return f"{branch_name}-{uuid}"
