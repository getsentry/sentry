from __future__ import absolute_import

from rest_framework.response import Response

import operator
import six

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import (Release, ReleaseCommit, Commit, CommitFileChange, Event, Group)
from sentry.api.serializers.models.commit import get_users_for_commits

from django.db.models import Q

from itertools import izip
from collections import defaultdict


def tokenize_path(path):
    # TODO(maxbittker) tokenize in a smarter crossplatform way.
    return reversed(path.split('/'))


def score_path_match_length(path_a, path_b):
    score = 0
    for a, b in izip(tokenize_path(path_a), tokenize_path(path_b)):
        if a != b:
            break
        score += 1
    return score


class EventFileCommittersEndpoint(ProjectEndpoint):
    def _get_frame_paths(self, event):
        data = event.data
        try:
            frames = data['sentry.interfaces.Stacktrace']['frames']
        except KeyError:
            try:
                frames = data['sentry.interfaces.Exception']['values'][0]['stacktrace']['frames']
            except (KeyError, TypeError):
                return []  # can't find stacktrace information

        return frames

    def _get_commits(self, releases):
        return list(Commit.objects.filter(
            releasecommit=ReleaseCommit.objects.filter(
                release__in=releases,
            )
        ).select_related('author'))

    def _get_commit_file_changes(self, commits, path_name_set):
        # build a single query to get all of the commit file that might match the first n frames

        path_query = reduce(
            operator.or_,
            (Q(filename__endswith=next(tokenize_path(path))) for path in path_name_set)
        )

        query = Q(commit__in=commits) & path_query

        commit_file_change_matches = CommitFileChange.objects.filter(query)

        return list(commit_file_change_matches)

    def _match_commits_path(self, commit_file_changes, path):
        #  find commits that match the run time path the best.
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
                matching_commits[file_change.commit.id] = file_change.commit

        return matching_commits.values()

    def _get_commits_committer(self, commits, author_id):
        committer_commit_list = [
            serialize(commit) for commit in commits if commit.author.id == author_id
        ]

        # filter out the author data
        for c in committer_commit_list:
            del c['author']
        return committer_commit_list

    def _get_committers(self, annotated_frames, commits):
        # extract the unique committers and return their serialized sentry accounts
        committers = defaultdict(int)

        limit = 5
        for annotated_frame in annotated_frames:
            if limit == 0:
                break
            for commit in annotated_frame['commits']:
                committers[commit.author.id] += limit
                limit -= 1
                if limit == 0:
                    break

        # organize them by this heuristic (first frame is worth 5 points, second is worth 4, etc.)
        sorted_committers = sorted(committers, key=committers.get)
        users_by_author = get_users_for_commits(commits)

        user_dicts = [
            {
                'author': users_by_author.get(six.text_type(author_id)),
                'commits': self._get_commits_committer(
                    commits,
                    author_id,
                )
            } for author_id in sorted_committers
        ]

        return user_dicts

    def get(self, _, project, event_id):
        """
        Retrieve Committer information for an event
        ```````````````````````````````

        Return commiters on an individual event, plus a per-frame breakdown.

        :pparam string project_slug: the slug of the project the event
                                     belongs to.
        :pparam string event_id: the hexadecimal ID of the event to
                                 retrieve (as reported by the raven client).
        :auth: required
        """
        try:
            event = Event.objects.get(
                id=event_id,
                project_id=project.id,
            )
        except Event.DoesNotExist:
            return Response({'detail': 'Event not found'}, status=404)

        # populate event data
        Event.objects.bind_nodes([event], 'data')

        group = Group.objects.get(id=event.group_id)

        first_release_version = group.get_first_release()

        if not first_release_version:
            return Response({'detail': 'Release not found'}, status=404)

        releases = Release.get_closest_releases(project, first_release_version)

        if not releases:
            return Response({'detail': 'Release not found'}, status=404)

        commits = self._get_commits(releases)

        if not commits:
            return Response({'detail': 'No Commits found for Release'}, status=404)

        frames = self._get_frame_paths(event)
        frame_limit = 15
        app_frames = [frame for frame in frames if frame['in_app']][:frame_limit]

        # TODO(maxbittker) return this set instead of annotated frames
        path_set = {frame['abs_path'] for frame in app_frames}

        file_changes = []
        if path_set:
            file_changes = self._get_commit_file_changes(commits, path_set)

        commit_path_matches = {
            path: self._match_commits_path(file_changes, path) for path in path_set
        }

        annotated_frames = [
            {
                'frame': frame,
                'commits': commit_path_matches[frame['abs_path']]
            } for frame in app_frames
        ]

        relevant_commits = list(
            {commit for match in commit_path_matches for commit in commit_path_matches[match]}
        )

        committers = self._get_committers(annotated_frames, relevant_commits)

        # serialize the commit objects
        serialized_annotated_frames = [
            {
                'frame': frame['frame'],
                'commits': serialize(frame['commits'])
            } for frame in annotated_frames
        ]

        data = {
            # map author ids to sentry user dicts
            'committers': committers,
            'annotatedFrames': serialized_annotated_frames
        }
        return Response(data)
