from __future__ import absolute_import

from mock import patch

from sentry.logging import audit
from sentry.models import AuditLogEntry, AuditLogEntryEvent
from sentry.testutils import TestCase


@patch('sentry.logging.audit.logger')
class AuditLogTestCase(TestCase):
    def test_log_line(self, mock_logger):
        log_obj = 'A Human Line.'
        audit.log(log_obj, logger=mock_logger)
        assert mock_logger.info.called
        mock_logger.info.assert_called_with(log_obj)

    def test_log_encoded_dict(self, mock_logger):
        log_obj = {'encode_me': 1L}
        audit.log(log_obj, logger=mock_logger)
        # Strip the call arguments of the crazy tuple nesting.
        call_arg = mock_logger.info.call_args
        while isinstance(call_arg, tuple):
            call_arg = call_arg[0]
        assert mock_logger.info.called
        assert call_arg == {'encode_me': '1'}


@patch('sentry.logging.audit.logger')
class AuditLogTestEntryCase(TestCase):
    def test_log_entry_human(self, mock_logger):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name='sentry')
        self.user.username = u'\u0420'
        self.user.save()
        entry = AuditLogEntry.objects.create(
            organization=org,
            event=AuditLogEntryEvent.ORG_EDIT,
            actor=self.user,
        )

        with self.options({'system.logging-format': 'human'}):
            with self.assertNumQueries(0):
                audit.log_entry(entry, logger=mock_logger)
            mock_logger.info.assert_called_with(
                '[Audit Log] [{org_id}] {actor_label} {note}'.format(
                    org_id=entry.organization_id,
                    actor_label='\xd0\xa0',  # Make sure we encode correctly.
                    note=entry.get_note()
                )
            )

    def test_log_entry_machine(self, mock_logger):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name='sentry')
        entry = AuditLogEntry.objects.create(
            organization=org,
            event=AuditLogEntryEvent.ORG_EDIT,
            actor=self.user,
        )

        with self.options({'system.logging-format': 'machine'}):
            with self.assertNumQueries(0):
                audit.log_entry(entry, logger=mock_logger)
            # Strip the call arguments of the crazy tuple nesting.
            call_arg = mock_logger.info.call_args
            while isinstance(call_arg, tuple):
                call_arg = call_arg[0]
            assert call_arg == {
                'actor_id': entry.actor_id,
                'data': '{}',
                'datetime': str(entry.datetime),
                'event': 'org.edit',
                'organization_id': entry.organization_id,
            }
