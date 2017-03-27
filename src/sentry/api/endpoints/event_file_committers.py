from __future__ import absolute_import

from rest_framework.response import Response

import operator

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import (
    Release, ReleaseCommit, Commit, CommitFileChange, Event
)
from sentry.api.serializers.models.release import get_users_for_commits

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
            except KeyError:
                return []  # can't find stacktrace information

        return frames

    def _get_commits(self, project, version):
        commits = Commit.objects.filter(
            releasecommit=ReleaseCommit.objects.filter(
                release=Release.objects.get(
                    projects=project,
                    version=version,
                ),
            )
        )
        return list(commits)

    def _get_commit_file_changes(self, commits, path_name_set):
        # build a single query to get all of the commit file that might match the first n frames

        path_query = reduce(operator.or_, (
            Q(filename__endswith=next(tokenize_path(path)))
            for path in path_name_set
        ))

        query = Q(commit__in=commits) & path_query

        commit_file_change_matches = CommitFileChange.objects.filter(query)

        return list(commit_file_change_matches)

    def _match_commits_frame(self, commit_file_changes, frame):
        #  find commits that match the run time path the best.

        matching_commits = {}
        best_score = 0
        for file_change in commit_file_changes:
            score = score_path_match_length(file_change.filename, frame['abs_path'])
            if score > best_score:
                # reset matches for better match.
                best_score = score
                matching_commits = {}
            if score == best_score:
                #  we want a list of unique commits that tie for longest match
                matching_commits[file_change.commit.id] = file_change.commit

        return matching_commits.values()

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
        sentry_user_dict = get_users_for_commits(commits)

        return [sentry_user_dict[author_id] for author_id in sorted_committers]

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

        commits = self._get_commits(event.project, event.get_tag('sentry:release'))
        if not commits:
            return Response({'detail': 'No Commits found for Release'}, status=404)

        frames = self._get_frame_paths(event)
        frame_limit = 10
        app_frames = [frame for frame in frames if frame['in_app']][:frame_limit]

        # TODO(maxbittker) return this set instead of annotated frames
        path_set = {frame['abs_path'] for frame in app_frames}

        file_changes = []
        if path_set:
            file_changes = self._get_commit_file_changes(commits, path_set)

        annotated_frames = [{
            'frame': frame,
            'commits': self._match_commits_frame(file_changes, frame)
        } for frame in app_frames]

        committers = self._get_committers(annotated_frames, commits)

        # serialize the commit objects
        serialized_annotated_frames = [{
            'frame': frame['frame'],
            'commits': serialize(frame['commits'])
        } for frame in annotated_frames]

        data = {
            # map author ids to sentry user dicts
            'committers': committers,
            'annotatedFrames': serialized_annotated_frames
        }
        return Response(data)
