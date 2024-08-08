from sentry.data_secrecy.models.datasecrecywaiver import DataSecrecyWaiver
from sentry.data_secrecy.service.model import RpcDataSecrecyWaiver


def serialize_data_secrecy_waiver(data_secrecy_waiver: DataSecrecyWaiver) -> RpcDataSecrecyWaiver:
    return RpcDataSecrecyWaiver(
        organization_id=data_secrecy_waiver.organization.id,
        access_start=data_secrecy_waiver.access_start,
        access_end=data_secrecy_waiver.access_end,
        zendesk_tickets=data_secrecy_waiver.zendesk_tickets,
    )
