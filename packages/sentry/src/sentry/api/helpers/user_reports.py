from sentry.models import Group, GroupStatus


def user_reports_filter_to_unresolved(user_reports):
    group_ids = {ur.group_id for ur in user_reports if ur.group_id}
    unresolved_group_ids = set()
    if group_ids:
        unresolved_group_ids = set(
            Group.objects.filter(id__in=group_ids, status=GroupStatus.UNRESOLVED).values_list(
                "id", flat=True
            )
        )
    return [ur for ur in user_reports if ur.group_id is None or ur.group_id in unresolved_group_ids]
