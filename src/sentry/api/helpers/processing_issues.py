from collections import defaultdict

from django.db.models import Count, Max

from sentry.api.serializers import serialize
from sentry.models import ProcessingIssue, ReprocessingReport
from sentry.utils.linksign import generate_signed_link


def get_processing_issues(user, projects, include_detailed_issues=False):
    """
    Given a list of projects, returns a list containing stats about processing
    issues for those projects
    :param include_detailed_issues: Include specific details on each processing
    issue
    :return: A list of dicts, with each dict containing keys:
        - 'hasIssues': Whether the project has any processing issues
        - 'numIssues': How many processing issues the project has
        - 'lastSeen': The date a processing issue was last seen
        - 'resolveableIssues': How many Raw Events have no remaining issues and
        can be resolved automatically
        - 'hasMoreResolveableIssues': Whether there are any Raw Events that
        have no remaining issues and can be resolved automatically
        'issuesProcessing': How many ReprocessingReports exist for this Project
        'signedLink': Signed link that takes the user to the reprocessing page
        for this project
        'project': Slug for the project

    """
    project_agg_results = {
        result["project"]: result
        for result in ProcessingIssue.objects.filter(project__in=projects)
        .values("project")
        .annotate(num_issues=Count("id"), last_seen=Max("datetime"))
    }
    project_reprocessing_issues = {
        result["project"]: result["reprocessing_issues"]
        for result in ReprocessingReport.objects.filter(project__in=projects)
        .values("project")
        .annotate(reprocessing_issues=Count("id"))
    }

    resolved_qs = ProcessingIssue.objects.find_resolved_queryset([p.id for p in projects])
    project_resolveable = {
        result["project"]: result["count"]
        for result in resolved_qs.values("project").annotate(count=Count("id"))
    }

    if include_detailed_issues:
        project_issues = defaultdict(list)
        for proc_issue in (
            ProcessingIssue.objects.with_num_events()
            .filter(project__in=projects)
            .order_by("type", "datetime")
        ):
            project_issues[proc_issue.project_id].append(proc_issue)

    project_results = []
    for project in projects:
        agg_results = project_agg_results.get(project.id, {})
        num_issues = agg_results.get("num_issues", 0)

        signed_link = None
        if num_issues > 0:
            signed_link = generate_signed_link(
                user,
                "sentry-api-0-project-fix-processing-issues",
                kwargs={
                    "project_slug": project.slug,
                    "organization_slug": project.organization.slug,
                },
            )

        last_seen = agg_results.get("last_seen")
        data = {
            "hasIssues": num_issues > 0,
            "numIssues": num_issues,
            "lastSeen": last_seen and serialize(last_seen) or None,
            "resolveableIssues": project_resolveable.get(project.id, 0),
            # XXX: Due to a bug in `find_resolved`, this was always returning
            # False. It's unused in our frontend, so just defaulting to False
            # so that we don't break any other consumers that expect this value.
            "hasMoreResolveableIssues": False,
            "issuesProcessing": project_reprocessing_issues.get(project.id, 0),
            "signedLink": signed_link,
            "project": project.slug,
        }
        if include_detailed_issues:
            issues = project_issues[project.id]
            data["issues"] = [serialize(issue, user) for issue in issues]

        project_results.append(data)

    return project_results
