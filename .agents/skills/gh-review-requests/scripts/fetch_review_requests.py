# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""
Fetch unread GitHub review-requested notifications for open (unmerged) PRs,
filtered by team membership and/or team review requests.

Usage:
    uv run fetch_review_requests.py --org ORG --teams TEAM1,TEAM2

Arguments:
    --org     GitHub organization slug (default: getsentry)
    --teams   Comma-separated team slugs to filter by (e.g. streaming-platform)

Output: JSON to stdout
"""

import argparse
import json
import subprocess
import sys


def gh(path: str, paginate: bool = False) -> list | dict:
    cmd = ["gh", "api", path]
    if paginate:
        cmd.append("--paginate")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not result.stdout:
        print(f"Error running gh {' '.join(cmd)}: {result.stderr}", file=sys.stderr)
        return [] if paginate else {}
    return json.loads(result.stdout)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--org", default="getsentry")
    parser.add_argument("--teams", required=True, help="Comma-separated team slugs")
    args = parser.parse_args()

    team_slugs = [t.strip() for t in args.teams.split(",")]

    # Resolve team members for all specified teams
    members: set[str] = set()
    team_display_names: dict[str, str] = {}
    for slug in team_slugs:
        data = gh(f"orgs/{args.org}/teams/{slug}/members", paginate=True)
        for m in data:
            members.add(m["login"])
        # Get display name
        team_data = gh(f"orgs/{args.org}/teams/{slug}")
        team_display_names[slug] = team_data.get("name", slug)

    # Fetch unread notifications (GitHub API default: unread only)
    all_notifs = gh("notifications", paginate=True)
    review_notifs = [
        n for n in all_notifs
        if n["reason"] == "review_requested" and n["unread"]
    ]

    prs = []
    for n in review_notifs:
        url = n["subject"]["url"]
        repo_path = url.replace("https://api.github.com/repos/", "")
        repo = repo_path.rsplit("/pulls/", 1)[0]
        pr_num = repo_path.rsplit("/", 1)[-1]
        html_url = f"https://github.com/{repo}/pull/{pr_num}"

        pr_data = gh(f"repos/{repo}/pulls/{pr_num}")
        if not pr_data:
            continue

        # Skip merged or closed PRs
        if pr_data.get("merged_at") or pr_data.get("state") == "closed":
            continue

        author = pr_data["user"]["login"]

        reviewers_data = gh(f"repos/{repo}/pulls/{pr_num}/requested_reviewers")
        requested_team_names = [t["slug"] for t in reviewers_data.get("teams", [])]
        matching_teams = [
            t for t in requested_team_names
            if any(slug.lower() == t.lower() for slug in team_slugs)
        ]

        by_team_member = author in members
        review_from_team = len(matching_teams) > 0

        if not (by_team_member or review_from_team):
            continue

        reasons = []
        if review_from_team:
            reasons.append(f"review requested from: {', '.join(matching_teams)}")
        if by_team_member:
            reasons.append(f"opened by: {author}")

        prs.append({
            "notification_id": n["id"],
            "title": n["subject"]["title"],
            "url": html_url,
            "repo": repo,
            "pr_number": int(pr_num),
            "author": author,
            "reasons": reasons,
        })

    print(json.dumps({"total": len(prs), "prs": prs}, indent=2))


if __name__ == "__main__":
    main()
