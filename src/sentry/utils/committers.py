from __future__ import absolute_import

import operator
import six

from sentry.api.serializers import serialize
from sentry.models import (Release, ReleaseCommit, Commit, CommitFileChange, Event, Group)
from sentry.api.serializers.models.commit import CommitSerializer, get_users_for_commits
from sentry.utils import metrics

from django.db.models import Q

from itertools import izip
from collections import defaultdict
from six.moves import reduce

PATH_SEPERATORS = frozenset(['/', '\\'])


def tokenize_path(path):
    for sep in PATH_SEPERATORS:
        if sep in path:
            return reversed(path.split(sep))
    else:
        return iter([path])


def score_path_match_length(path_a, path_b):
    score = 0
    for a, b in izip(tokenize_path(path_a), tokenize_path(path_b)):
        if a != b:
            break
        score += 1
    return score


def _get_frame_paths(event):
    data = event.data
    try:
        frames = data['sentry.interfaces.Stacktrace']['frames']
    except KeyError:
        try:
            frames = data['sentry.interfaces.Exception']['values'][0]['stacktrace']['frames']
        except (KeyError, TypeError):
            return []  # can't find stacktrace information

    return frames


def _get_commits(releases):
    return list(Commit.objects.filter(
        releasecommit=ReleaseCommit.objects.filter(
            release__in=releases,
        )
    ).select_related('author'))


def _get_commit_file_changes(commits, path_name_set):
    # build a single query to get all of the commit file that might match the first n frames
    path_query = reduce(
        operator.or_,
        (Q(filename__endswith=next(tokenize_path(path))) for path in path_name_set)
    )

    commit_file_change_matches = CommitFileChange.objects.filter(
        path_query,
        commit__in=commits,
    )

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

    return matching_commits.values()


def _get_commits_committer(commits, author_id):
    result = serialize([
        commit for commit, score in commits if commit.author.id == author_id
    ], serializer=CommitSerializer(exclude=['author']))
    for idx, row in enumerate(result):
        row['score'] = commits[idx][1]
    return result


def _get_committers(annotated_frames, commits):
    # extract the unique committers and return their serialized sentry accounts
    committers = defaultdict(int)

    limit = 5
    for annotated_frame in annotated_frames:
        if limit == 0:
            break
        for commit, score in annotated_frame['commits']:
            committers[commit.author.id] += limit
            limit -= 1
            if limit == 0:
                break

    # organize them by this heuristic (first frame is worth 5 points, second is worth 4, etc.)
    sorted_committers = sorted(committers, key=committers.get)
    users_by_author = get_users_for_commits([c for c, _ in commits])

    user_dicts = [
        {
            'author': users_by_author.get(six.text_type(author_id)),
            'commits': _get_commits_committer(
                commits,
                author_id,
            )
        } for author_id in sorted_committers
    ]

    return user_dicts


def get_previous_releases(project, start_version, limit=5):
    # given a release version + project, return the previous
    # `limit` releases (includes the release specified by `version`)
    try:
        release_dates = Release.objects.filter(
            organization_id=project.organization_id,
            version=start_version,
            projects=project,
        ).values('date_released', 'date_added').get()
    except Release.DoesNotExist:
        return []

    start_date = release_dates['date_released'] or release_dates['date_added']

    return list(Release.objects.filter(
        projects=project,
        organization_id=project.organization_id,
    ).extra(
        select={
            'date': 'COALESCE(date_released, date_added)',
        },
        where=["COALESCE(date_released, date_added) <= %s"],
        params=[start_date]
    ).extra(
        order_by=['-date']
    )[:limit])


def get_event_file_committers(project, event, frame_limit=25):
    # populate event data
    Event.objects.bind_nodes([event], 'data')

    group = Group.objects.get(id=event.group_id)

    first_release_version = group.get_first_release()

    if not first_release_version:
        raise Release.DoesNotExist

    releases = get_previous_releases(project, first_release_version)
    if not releases:
        raise Release.DoesNotExist

    commits = _get_commits(releases)

    if not commits:
        raise Commit.DoesNotExist

    frames = _get_frame_paths(event)
    app_frames = [frame for frame in frames if frame['in_app']][-frame_limit:]
    if not app_frames:
        app_frames = [frame for frame in frames][-frame_limit:]

    # TODO(maxbittker) return this set instead of annotated frames
    # XXX(dcramer): frames may not define a filepath. For example, in Java its common
    # to only have a module name/path
    path_set = {f for f in (frame.get('filename') or frame.get('abs_path')
                            for frame in app_frames) if f}

    file_changes = []
    if path_set:
        file_changes = _get_commit_file_changes(commits, path_set)

    commit_path_matches = {
        path: _match_commits_path(file_changes, path) for path in path_set
    }

    annotated_frames = [
        {
            'frame': frame,
            'commits': commit_path_matches.get(frame.get('filename') or frame.get('abs_path')) or []
        } for frame in app_frames
    ]

    relevant_commits = list(
        {match for match in commit_path_matches for match in commit_path_matches[match]}
    )

    committers = _get_committers(annotated_frames, relevant_commits)
    metrics.incr('feature.owners.has-committers', instance='hit' if committers else 'miss')
    return committers
