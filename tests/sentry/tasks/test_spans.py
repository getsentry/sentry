import uuid
from unittest import mock

from sentry.issues.grouptype import PerformanceStreamedSpansGroupTypeExperimental
from sentry.spans.buffer.redis import RedisSpansBuffer
from sentry.tasks.spans import _process_segment
from sentry.testutils.cases import TestCase

segment_span = '{"description":"OrganizationNPlusOne","duration_ms":107,"event_id":"61ccae71d70f45bb9b1f2ccb7f7a49ec","exclusive_time_ms":107.359,"is_segment":true,"parent_span_id":"b35b839c02985f33","profile_id":"dbae2b82559649a1a34a2878134a007b","project_id":1,"received":1707953019.044972,"retention_days":90,"segment_id":"a49b42af9fb69da0","sentry_tags":{"browser.name":"Google Chrome","environment":"development","op":"base.dispatch.sleep","release":"backend@24.2.0.dev0+699ce0cd1281cc3c7275d0a474a595375c769ae8","transaction":"/api/0/organizations/{organization_slug}/n-plus-one/","transaction.method":"GET","transaction.op":"http.server","user":"id:1"},"span_id":"a49b42af9fb69da0","start_timestamp_ms":1707953018880,"trace_id":"94576097f3a64b68b85a59c7d4e3ee2a"}'
span_1 = '{"description":"OrganizationNPlusOne.get","duration_ms":12,"event_id":"61ccae71d70f45bb9b1f2ccb7f7a49ec","exclusive_time_ms":4.665,"is_segment":false,"parent_span_id":"b35b839c02985f33","profile_id":"dbae2b82559649a1a34a2878134a007b","project_id":1,"received":1707953019.044972,"retention_days":90,"segment_id":"a49b42af9fb69da0","sentry_tags":{"browser.name":"Google Chrome","environment":"development","op":"base.dispatch.execute","release":"backend@24.2.0.dev0+699ce0cd1281cc3c7275d0a474a595375c769ae8","transaction":"/api/0/organizations/{organization_slug}/n-plus-one/","transaction.method":"GET","transaction.op":"http.server","user":"id:1"},"span_id":"940ce942561548b5","start_timestamp_ms":1707953018867,"trace_id":"94576097f3a64b68b85a59c7d4e3ee2a"}'
cause_span = '{"description":"SELECT \\"sentry_project\\".\\"id\\", \\"sentry_project\\".\\"slug\\", \\"sentry_project\\".\\"name\\", \\"sentry_project\\".\\"forced_color\\", \\"sentry_project\\".\\"organization_id\\", \\"sentry_project\\".\\"public\\", \\"sentry_project\\".\\"date_added\\", \\"sentry_project\\".\\"status\\", \\"sentry_project\\".\\"first_event\\", \\"sentry_project\\".\\"flags\\", \\"sentry_project\\".\\"platform\\" FROM \\"sentry_project\\"","duration_ms":0,"event_id":"61ccae71d70f45bb9b1f2ccb7f7a49ec","exclusive_time_ms":0.554,"is_segment":false,"parent_span_id":"940ce942561548b5","profile_id":"dbae2b82559649a1a34a2878134a007b","project_id":1,"received":1707953019.044972,"retention_days":90,"segment_id":"a49b42af9fb69da0","sentry_tags":{"action":"SELECT","browser.name":"Google Chrome","category":"db","description":"SELECT .. FROM sentry_project","domain":",sentry_project,","environment":"development","group":"283c68290ddc2c50","op":"db","release":"backend@24.2.0.dev0+699ce0cd1281cc3c7275d0a474a595375c769ae8","system":"postgresql","transaction":"/api/0/organizations/{organization_slug}/n-plus-one/","transaction.method":"GET","transaction.op":"http.server","user":"id:1"},"span_id":"a974da4671bc3857","start_timestamp_ms":1707953018867,"trace_id":"94576097f3a64b68b85a59c7d4e3ee2a"}'
repeating_span_1 = '{"description":"SELECT \\"sentry_organization\\".\\"id\\", \\"sentry_organization\\".\\"name\\", \\"sentry_organization\\".\\"slug\\", \\"sentry_organization\\".\\"status\\", \\"sentry_organization\\".\\"date_added\\", \\"sentry_organization\\".\\"default_role\\", \\"sentry_organization\\".\\"is_test\\", \\"sentry_organization\\".\\"flags\\" FROM \\"sentry_organization\\" WHERE \\"sentry_organization\\".\\"id\\" = %s LIMIT 21","duration_ms":500,"event_id":"61ccae71d70f45bb9b1f2ccb7f7a49ec","exclusive_time_ms":0.689,"is_segment":false,"parent_span_id":"940ce942561548b5","profile_id":"dbae2b82559649a1a34a2878134a007b","project_id":1,"received":1707953019.044972,"retention_days":90,"segment_id":"a49b42af9fb69da0","sentry_tags":{"action":"SELECT","browser.name":"Google Chrome","category":"db","description":"SELECT .. FROM sentry_organization WHERE id = %s LIMIT %s","domain":",sentry_organization,","environment":"development","group":"c40fc66225c6f13e","op":"db","release":"backend@24.2.0.dev0+699ce0cd1281cc3c7275d0a474a595375c769ae8","system":"postgresql","transaction":"/api/0/organizations/{organization_slug}/n-plus-one/","transaction.method":"GET","transaction.op":"http.server","user":"id:1"},"span_id":"placeholder_span_id","start_timestamp_ms":1707953018869,"trace_id":"94576097f3a64b68b85a59c7d4e3ee2a"}'


class TestSpansTask(TestCase):
    def setUp(self):
        self.project = self.create_project()

    @mock.patch.object(RedisSpansBuffer, "read_segment")
    def test_n_plus_one_issue_detection(self, mock_read_segment):
        repeating_spans = [
            repeating_span_1.replace("placeholder_span_id", uuid.uuid4().hex[:16]) for _ in range(7)
        ]
        spans = [segment_span, span_1, cause_span] + repeating_spans

        mock_read_segment.return_value = spans
        job = _process_segment(self.project.id, "a49b42af9fb69da0")

        assert (
            job["performance_problems"][0].fingerprint
            == "1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-d4e059f4c8c61480237bd2051e7c3869f3d4ff51"
        )

        assert job["performance_problems"][0].type == PerformanceStreamedSpansGroupTypeExperimental
