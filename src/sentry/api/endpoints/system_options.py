from django.conf import settings
from rest_framework.response import Response

import sentry
from sentry import options
from sentry.api.base import Endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.utils.email import is_smtp_enabled


class SystemOptionsEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        query = request.GET.get("query")
        if query == "is:required":
            option_list = options.filter(flag=options.FLAG_REQUIRED)
        elif query:
            return Response(f"{query} is not a supported search query", status=400)
        else:
            option_list = options.all()

        smtp_disabled = not is_smtp_enabled()

        results = {}
        for k in option_list:
            disabled, disabled_reason = False, None

            if smtp_disabled and k.name[:5] == "mail.":
                disabled_reason, disabled = "smtpDisabled", True
            elif bool(
                k.flags & options.FLAG_PRIORITIZE_DISK and settings.SENTRY_OPTIONS.get(k.name)
            ):
                # TODO(mattrobenolt): Expose this as a property on Key.
                disabled_reason, disabled = "diskPriority", True

            # TODO(mattrobenolt): help, placeholder, title, type
            results[k.name] = {
                "value": options.get(k.name),
                "field": {
                    "default": k.default(),
                    "required": bool(k.flags & options.FLAG_REQUIRED),
                    "disabled": disabled,
                    "disabledReason": disabled_reason,
                    "isSet": options.isset(k.name),
                    "allowEmpty": bool(k.flags & options.FLAG_ALLOW_EMPTY),
                },
            }

        return Response(results)

    def put(self, request):
        # TODO(dcramer): this should validate options before saving them
        for k, v in request.data.items():
            if v and isinstance(v, str):
                v = v.strip()
            try:
                option = options.lookup_key(k)
            except options.UnknownOption:
                # TODO(dcramer): unify API errors
                return Response(
                    {"error": "unknown_option", "errorDetail": {"option": k}}, status=400
                )

            try:
                if not (option.flags & options.FLAG_ALLOW_EMPTY) and not v:
                    options.delete(k)
                else:
                    options.set(k, v)
            except (TypeError, AssertionError) as e:
                # TODO(chadwhitacre): Use a custom exception for the
                # immutability case, especially since asserts disappear with
                # `python -O`.
                return Response(
                    {
                        "error": "invalid_type" if type(e) is TypeError else "immutable_option",
                        "errorDetail": {"option": k, "message": str(e)},
                    },
                    status=400,
                )
        # TODO(dcramer): this has nothing to do with configuring options and
        # should not be set here
        options.set("sentry:version-configured", sentry.get_version())
        return Response(status=200)
