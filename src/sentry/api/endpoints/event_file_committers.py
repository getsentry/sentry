from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import (
    Release, ReleaseCommit, Commit, CommitFileChange, Event
)

from itertools import izip
from collections import defaultdict


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

    def _score_path_match_length(self, pathA, pathB):
        segmentsA = reversed(pathA.split('/'))  # todo maxbittker better splitting
        segmentsB = reversed(pathB.split('/'))
        score = 0
        for a, b in izip(segmentsA, segmentsB):
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
        except Commit.DoesNotExist:
            return None
        return commits

    def _match_commits_frame(self, commits, frame):

        matchingCommits = []

        for commit in commits:
            possibleFileChangeMatches = CommitFileChange.objects.filter(
                commit=commit.id,
                filename__endswith=frame['filename']
            )

            bestScore = 1
            match = None
            for fileChange in possibleFileChangeMatches:
                score = self._score_path_match_length(fileChange.filename, frame['abs_path'])
                if score > bestScore:
                    bestScore = score
                    match = fileChange

            if match:
                matchingCommits.append(serialize(commit))

        return matchingCommits

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

        annotatedFrames = [{
            'frame': frame,
            'commits': self._match_commits_frame(commits, frame)
        } for frame in frames]

        committers = defaultdict(int)
        limit = 5
        for annotatedFrame in annotatedFrames:
            if limit == 0:
                break
            for commit in annotatedFrame['commits']:
                if limit == 0:
                    break
                committers[commit['author']['email']] += limit
                limit -= 1

        sortedCommitters = sorted(committers, key=committers.get)

        data = {
            'committers': sortedCommitters,  # todo maxbittker richer data than email here
            'annotatedFrames': annotatedFrames
        }
        return Response(data)
