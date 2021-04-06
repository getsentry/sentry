import operator
from collections import defaultdict
from functools import reduce

from django.core.cache import cache
from django.db.models import Q

from sentry.api.serializers import serialize
from sentry.api.serializers.models.commit import CommitSerializer, get_users_for_commits
from sentry.models import Commit, CommitFileChange, Group, Release, ReleaseCommit
from sentry.utils import metrics
from sentry.utils.compat import zip
from sentry.utils.hashlib import hash_values
from sentry.utils.safe import get_path

PATH_SEPARATORS = frozenset(["/", "\\"])


def tokenize_path(path):
    for sep in PATH_SEPARATORS:
        if sep in path:
            # Exclude empty path segments as some repository integrations
            # start their paths with `/` which we want to ignore.
            return reversed([x for x in path.split(sep) if x != ""])
    else:
        return iter([path])


def score_path_match_length(path_a, path_b):
    score = 0
    for a, b in zip(tokenize_path(path_a), tokenize_path(path_b)):
        if a.lower() != b.lower():
            break
        score += 1
    return score


def get_frame_paths(data):
    frames = get_path(data, "stacktrace", "frames", filter=True)
    if frames:
        return frames

    return get_path(data, "exception", "values", 0, "stacktrace", "frames", filter=True) or []


def release_cache_key(release):
    return f"release_commits:{release.id}"


def _get_commits(releases):
    commits = []

    fetched = cache.get_many([release_cache_key(release) for release in releases])
    if fetched:
        missed = []
        for release in releases:
            cached_commits = fetched.get(release_cache_key(release))
            if cached_commits is None:
                missed.append(release)
            else:
                commits += [c for c in cached_commits if c not in commits]
    else:
        missed = releases

    if missed:
        release_commits = ReleaseCommit.objects.filter(release__in=missed).select_related(
            "commit", "release", "commit__author"
        )
        to_cache = defaultdict(list)
        for rc in release_commits:
            to_cache[release_cache_key(rc.release)].append(rc.commit)
            if rc.commit not in commits:
                commits.append(rc.commit)
        cache.set_many(to_cache)

    return commits


def _get_commit_file_changes(commits, path_name_set):
    # Get distinct file names and bail if there are no files.
    filenames = {next(tokenize_path(path), None) for path in path_name_set}
    filenames = {path for path in filenames if path is not None}
    if not len(filenames):
        return []

    # build a single query to get all of the commit file that might match the first n frames
    path_query = reduce(operator.or_, (Q(filename__iendswith=path) for path in filenames))

    commit_file_change_matches = CommitFileChange.objects.filter(path_query, commit__in=commits)

    return list(commit_file_change_matches)


def _match_commits_path(commit_file_changes, path):
    # find commits that match the run time path the best.
    matching_commits = {}
    best_score = 1
    for file_change in commit_file_changes:
        score = score_path_match_length(file_change.filename, path)
        if score > best_score:
            # reset matches for better match.
            best_score = score
            matching_commits = {}
        if score == best_score:
            # skip 1-score matches when file change is longer than 1 token
            if score == 1 and len(list(tokenize_path(file_change.filename))) > 1:
                continue
            #  we want a list of unique commits that tie for longest match
            matching_commits[file_change.commit.id] = (file_change.commit, score)

    return list(matching_commits.values())


def _get_committers(annotated_frames, commits):
    # extract the unique committers and return their serialized sentry accounts
    committers = defaultdict(int)

    limit = 5
    for annotated_frame in annotated_frames:
        if limit == 0:
            break
        for commit, score in annotated_frame["commits"]:
            if not commit.author_id:
                continue
            committers[commit.author_id] += limit
            limit -= 1
            if limit == 0:
                break

    # organize them by this heuristic (first frame is worth 5 points, second is worth 4, etc.)
    sorted_committers = sorted(committers, key=committers.get)
    users_by_author = get_users_for_commits([c for c, _ in commits])

    user_dicts = [
        {
            "author": users_by_author.get(str(author_id)),
            "commits": [
                (commit, score) for (commit, score) in commits if commit.author_id == author_id
            ],
        }
        for author_id in sorted_committers
    ]

    return user_dicts


def get_previous_releases(project, start_version, limit=5):
    # given a release version + project, return the previous
    # `limit` releases (includes the release specified by `version`)
    key = "get_previous_releases:1:%s" % hash_values([project.id, start_version, limit])
    rv = cache.get(key)
    if rv is None:
        try:
            first_release = Release.objects.filter(
                organization_id=project.organization_id, version=start_version, projects=project
            ).get()
        except Release.DoesNotExist:
            rv = []
        else:
            start_date = first_release.date_released or first_release.date_added

            # XXX: This query could be very inefficient for projects with a large
            # number of releases. To work around this, we only check 100 releases
            # ordered by highest release id, which is generally correlated with
            # most recent releases for a project. This isn't guaranteed to be correct,
            # since `date_released` could end up out of order, but should be close
            # enough for what we need this for with suspect commits.
            # To make this better, we should denormalize the coalesce of date_released
            # and date_added onto `ReleaseProject`, which would have benefits for other
            # similar queries.
            rv = list(
                Release.objects.raw(
                    """
                        SELECT sr.*
                        FROM sentry_release as sr
                        INNER JOIN (
                            SELECT release_id
                            FROM sentry_release_project
                            WHERE project_id = %s
                            AND sentry_release_project.release_id <= %s
                            ORDER BY release_id desc
                            LIMIT 100
                        ) AS srp ON (sr.id = srp.release_id)
                        WHERE sr.organization_id = %s
                        AND coalesce(sr.date_released, sr.date_added) <= %s
                        ORDER BY coalesce(sr.date_released, sr.date_added) DESC
                        LIMIT %s;
                    """,
                    [project.id, first_release.id, project.organization_id, start_date, limit],
                )
            )
        cache.set(key, rv, 60)
    return rv


def get_event_file_committers(project, group_id, event_frames, event_platform, frame_limit=25):
    group = Group.objects.get_from_cache(id=group_id)

    first_release_version = group.get_first_release()

    if not first_release_version:
        raise Release.DoesNotExist

    releases = get_previous_releases(project, first_release_version)
    if not releases:
        raise Release.DoesNotExist

    commits = _get_commits(releases)

    if not commits:
        raise Commit.DoesNotExist

    frames = event_frames or ()
    app_frames = [frame for frame in frames if frame["in_app"]][-frame_limit:]
    if not app_frames:
        app_frames = [frame for frame in frames][-frame_limit:]

    # Java stackframes don't have an absolute path in the filename key.
    # That property is usually just the basename of the file. In the future
    # the Java SDK might generate better file paths, but for now we use the module
    # path to approximate the file path so that we can intersect it with commit
    # file paths.
    if event_platform == "java":
        for frame in frames:
            if frame.get("filename") is None:
                continue
            if "/" not in frame.get("filename") and frame.get("module"):
                # Replace the last module segment with the filename, as the
                # terminal element in a module path is the class
                module = frame["module"].split(".")
                module[-1] = frame["filename"]
                frame["filename"] = "/".join(module)

    # TODO(maxbittker) return this set instead of annotated frames
    # XXX(dcramer): frames may not define a filepath. For example, in Java its common
    # to only have a module name/path
    path_set = {
        f for f in (frame.get("filename") or frame.get("abs_path") for frame in app_frames) if f
    }

    file_changes = []
    if path_set:
        file_changes = _get_commit_file_changes(commits, path_set)

    commit_path_matches = {path: _match_commits_path(file_changes, path) for path in path_set}

    annotated_frames = [
        {
            "frame": frame,
            "commits": commit_path_matches.get(frame.get("filename") or frame.get("abs_path"))
            or [],
        }
        for frame in app_frames
    ]

    relevant_commits = list(
        {match for match in commit_path_matches for match in commit_path_matches[match]}
    )

    return _get_committers(annotated_frames, relevant_commits)


def get_serialized_event_file_committers(project, event, frame_limit=25):
    event_frames = get_frame_paths(event.data)
    committers = get_event_file_committers(
        project, event.group_id, event_frames, event.platform, frame_limit=frame_limit
    )
    commits = [commit for committer in committers for commit in committer["commits"]]
    serialized_commits = serialize(
        [c for (c, score) in commits], serializer=CommitSerializer(exclude=["author"])
    )

    serialized_commits_by_id = {}

    for (commit, score), serialized_commit in zip(commits, serialized_commits):
        serialized_commit["score"] = score
        serialized_commits_by_id[commit.id] = serialized_commit

    for committer in committers:
        commit_ids = [commit.id for (commit, _) in committer["commits"]]
        commits_result = [serialized_commits_by_id[commit_id] for commit_id in commit_ids]
        committer["commits"] = dedupe_commits(commits_result)

    metrics.incr(
        "feature.owners.has-committers",
        instance="hit" if committers else "miss",
        skip_internal=False,
    )
    return committers


def dedupe_commits(commits):
    return list({c["id"]: c for c in commits}.values())
