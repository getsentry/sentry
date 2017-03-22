from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import (
    Release, ReleaseCommit, Commit, CommitFileChange, Event
)
from sentry.api.serializers.models.release import get_users_for_commits

from itertools import izip
from collections import defaultdict


def tokenize_path(path):
    return reversed(path.split('/'))


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

    def _score_path_match_length(self, path_a, path_b):
        score = 0
        for a, b in izip(tokenize_path(path_a), tokenize_path(path_b)):
            if a != b:
                break
            score += 1
        return score

    def _get_commits(self, project_id, version):
        try:
            commits = Commit.objects.filter(
                releasecommit=ReleaseCommit.objects.filter(
                    release=Release.objects.get(
                        projects=project_id,
                        version=version,
                    ),
                )
            )
        except Release.DoesNotExist:
            return None
        return list(commits)

    def _match_commits_frame(self, commits, frame):

        possible_file_change_matches = CommitFileChange.objects.filter(
            commit__in=commits,
            filename__endswith=frame['filename']  # TODO(maxbittker) take last token the same way as score_path_match
        )

        matching_commits = {}
        best_score = 0
        for file_change in possible_file_change_matches:
            score = self._score_path_match_length(file_change.filename, frame['abs_path'])
            if score > best_score:
                # reset matches for better match.
                best_score = score
                matching_commits = {}
            if score == best_score:
                #  we want a list of unique commits that tie for longest match
                matching_commits[file_change.commit.id] = file_change.commit

        return matching_commits.values()

    def get(self, request, project, event_id):
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

        Event.objects.bind_nodes([event], 'data')
        frames = self._get_frame_paths(event)

        commits = self._get_commits(project.id, event.get_tag('sentry:release'))
        if not commits:
            return Response({'detail': 'No Commits found for Release'}, status=404)

        annotated_frames = [{
            'frame': frame,
            'commits': self._match_commits_frame(commits, frame)
        } for frame in frames]

        committers = defaultdict(int)
        limit = 5
        for annotated_frame in annotated_frames:
            if limit == 0:
                break
            for commit in annotated_frame['commits']:
                if limit == 0:
                    break
                committers[commit.author.id] += limit
                limit -= 1

        sorted_committers = sorted(committers, key=committers.get)
        sentry_user_dict = get_users_for_commits(commits)

        serialized_annotated_frames = [{
            'frame': frame['frame'],
            'commits': serialize(frame['commits'])
        } for frame in annotated_frames]

        data = {
            'committers': [sentry_user_dict[author_id] for author_id in sorted_committers],
            'annotatedFrames': serialized_annotated_frames
        }
        return Response(data)
