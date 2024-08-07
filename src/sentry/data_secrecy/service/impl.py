from sentry.data_secrecy.models.datasecrecywaiver import DataSecrecyWaiver
from sentry.data_secrecy.service.model import RpcDataSecrecyWaiver
from sentry.data_secrecy.service.serial import serialize_data_secrecy_waiver
from sentry.data_secrecy.service.service import DataSecrecyService


class DatabaseBackedDataSecrecyService(DataSecrecyService):
    def get_data_secrecy_waiver(self, *, organization_id: int) -> RpcDataSecrecyWaiver | None:
        data_secrecy_waiver = DataSecrecyWaiver.objects.filter(
            organization_id=organization_id
        ).first()

        if not data_secrecy_waiver:
            return None

        return serialize_data_secrecy_waiver(data_secrecy_waiver=data_secrecy_waiver)
