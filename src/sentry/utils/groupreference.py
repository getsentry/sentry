import re

_fixes_re = re.compile(
    r"\b(?:Fix|Fixes|Fixed|Close|Closes|Closed|Resolve|Resolves|Resolved):?\s+([A-Za-z0-9_\-\s\,]+)\b",
    re.I,
)
_short_id_re = re.compile(r"\b([A-Z0-9_-]+-[A-Z0-9]+)\b", re.I)


def find_referenced_groups(text, org_id):
    from sentry.models import Group

    if not text:
        return set()

    results = set()
    for fmatch in _fixes_re.finditer(text):
        for smatch in _short_id_re.finditer(fmatch.group(1)):
            short_id = smatch.group(1)
            try:
                group = Group.objects.by_qualified_short_id(
                    organization_id=org_id, short_id=short_id
                )
            except Group.DoesNotExist:
                continue
            else:
                results.add(group)
    return results


branch_re = re.compile(r"FIXES-\b([A-Z0-9_]+-[A-Z0-9]+)\b")


def find_referenced_groups_in_branch(branch_name, org_id):
    from sentry.models import Group

    if not branch_name:
        return set()

    results = set()
    for smatch in branch_re.finditer(branch_name):
        short_id = smatch.group(1)
        try:
            group = Group.objects.by_qualified_short_id(organization_id=org_id, short_id=short_id)
        except Group.DoesNotExist:
            continue
        else:
            results.add(group)

    return results
