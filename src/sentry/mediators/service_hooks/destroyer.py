from sentry.mediators import Mediator, Param


class Destroyer(Mediator):
    service_hook = Param("sentry.models.ServiceHook")

    def call(self):
        self._destroy_service_hook()
        return self.service_hook

    def _destroy_service_hook(self):
        self.service_hook.delete()
