import logging
import re
from datetime import timedelta
from functools import reduce
from string import Template

from django.db import router
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.endpoints.relocations import ERR_FEATURE_DISABLED
from sentry.api.fields.sentry_slug import ORG_SLUG_PATTERN
from sentry.api.paginator import OffsetPaginator
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.relocation import RelocationSerializer
from sentry.models.files.file import File
from sentry.models.relocation import Relocation, RelocationFile
from sentry.models.user import MAX_USERNAME_LENGTH
from sentry.options import get
from sentry.search.utils import tokenize_query
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.tasks.relocation import uploading_complete
from sentry.utils.db import atomic_transaction
from sentry.utils.relocation import RELOCATION_BLOB_SIZE, RELOCATION_FILE_TYPE

ERR_DUPLICATE_RELOCATION = "An in-progress relocation already exists for this owner"
ERR_THROTTLED_RELOCATION = (
    "We've reached our daily limit of relocations - please try again tomorrow or contact support."
)
ERR_OWNER_NOT_FOUND = Template("Could not find user `$owner_username`.")
ERR_INVALID_ORG_SLUG = Template("Org slug is invalid: `$org_slug`.")
ERR_UNKNOWN_RELOCATION_STATUS = Template("`$status` is not a valid relocation status.")

logger = logging.getLogger(__name__)

RELOCATION_FILE_SIZE_SMALL = 10 * 1024**2
RELOCATION_FILE_SIZE_MEDIUM = 100 * 1024**2


def get_relocation_size_category(size) -> str:
    if size < RELOCATION_FILE_SIZE_SMALL:
        return "small"
    elif size < RELOCATION_FILE_SIZE_MEDIUM:
        return "medium"
    return "large"


def should_throttle_relocation(relocation_bucket_size) -> bool:
    recent_relocation_files = RelocationFile.objects.filter(
        date_added__gte=(timezone.now() - timedelta(days=1))
    )
    num_recent_same_size_relocation_files = reduce(
        lambda acc, relocation_file: acc + 1
        if get_relocation_size_category(relocation_file.file.size) == relocation_bucket_size
        else acc,
        recent_relocation_files,
        0,
    )
    if num_recent_same_size_relocation_files < get(
        f"relocation.daily-limit-{relocation_bucket_size}"
    ):
        return False
    return True


class RelocationsPostSerializer(serializers.Serializer):
    file = serializers.FileField(required=True)
    orgs = serializers.CharField(required=True, allow_blank=False, allow_null=False)
    owner = serializers.CharField(
        max_length=MAX_USERNAME_LENGTH, required=True, allow_blank=False, allow_null=False
    )


@region_silo_endpoint
class RelocationIndexEndpoint(Endpoint):
    owner = ApiOwner.RELOCATION
    publish_status = {
        # TODO(getsentry/team-ospo#214): Stabilize before GA.
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    # TODO(getsentry/team-ospo#214): Open up permissions before GA.
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request) -> Response:
        """
        A list of relocations, ordered by creation date.
        ``````````````````````````````````````````````````

        :qparam string query: string to match in importing org slugs, username, or relocation UUID.
        :qparam string status: filter by status.

        :auth: required
        """

        queryset = Relocation.objects.all()
        query = request.GET.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "query":
                    # Every supplied search term must appear at least once in ANY of the UUID, org
                    # slug list, or username list for the relocation to be matched.
                    for term in value:
                        queryset = queryset.filter(
                            Q(uuid__icontains=term)
                            | Q(want_org_slugs__icontains=term)
                            | Q(want_usernames__icontains=term)
                        )

        status_str = request.GET.get("status")
        if status_str:
            try:
                status = Relocation.Status[status_str.upper()]
            except KeyError:
                return Response(
                    {"detail": ERR_UNKNOWN_RELOCATION_STATUS.substitute(status=status_str)},
                    status=400,
                )

            queryset = queryset.filter(status=status.value)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="date_added",
            on_results=lambda x: serialize(x, request.user, RelocationSerializer()),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request) -> Response:
        """
        Upload an encrypted export tarball for relocation.
        ``````````````````````````````````````````````````

        Upload an encrypted relocation tarball for relocation.

        This is currently an experimental API, and for the time being is only meant to be called by
        admins.

        :param file file: the multipart encoded tarball file.
        :param string owner: the username of the "owner" of this relocation; not necessarily
                             identical to the user who made the API call.
        :param list[string] orgs: A list of org slugs from those included in the associated
                                  encrypted backup tarball that should be imported.
        :auth: required
        """

        logger.info("post.start", extra={"caller": request.user.id})
        if not options.get("relocation.enabled"):
            return Response({"detail": ERR_FEATURE_DISABLED}, status=400)

        serializer = RelocationsPostSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        validated = serializer.validated_data
        fileobj = validated.get("file")
        owner_username = validated.get("owner")
        org_slugs = [org.strip() for org in validated.get("orgs").split(",")]
        for org_slug in org_slugs:
            if not re.match(ORG_SLUG_PATTERN, org_slug):
                return Response(
                    {"detail": ERR_INVALID_ORG_SLUG.substitute(org_slug=org_slug)}, status=400
                )
        try:
            owner = user_service.get_by_username(username=owner_username)[0]
        except IndexError:
            return Response(
                {"detail": ERR_OWNER_NOT_FOUND.substitute(owner_username=owner_username)},
                status=400,
            )

        # Quickly check that this `owner` does not have more than one active `Relocation` in flight.
        if Relocation.objects.filter(
            owner_id=owner.id, status=Relocation.Status.IN_PROGRESS.value
        ).exists():
            return Response({"detail": ERR_DUPLICATE_RELOCATION}, status=409)

        relocation_size_category = get_relocation_size_category(fileobj.size)
        if should_throttle_relocation(relocation_size_category):
            return Response(
                {"detail": ERR_THROTTLED_RELOCATION},
                status=429,
            )

        file = File.objects.create(name="raw-relocation-data.tar", type=RELOCATION_FILE_TYPE)
        file.putfile(fileobj, blob_size=RELOCATION_BLOB_SIZE, logger=logger)

        with atomic_transaction(
            using=(router.db_for_write(Relocation), router.db_for_write(RelocationFile))
        ):
            relocation: Relocation = Relocation.objects.create(
                creator_id=request.user.id,
                owner_id=owner.id,
                want_org_slugs=org_slugs,
                step=Relocation.Step.UPLOADING.value,
            )
            RelocationFile.objects.create(
                relocation=relocation,
                file=file,
                kind=RelocationFile.Kind.RAW_USER_DATA.value,
            )

        uploading_complete.delay(relocation.uuid)
        return Response(status=201)
