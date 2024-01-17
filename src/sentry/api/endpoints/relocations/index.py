import logging
import re
from datetime import timedelta
from functools import reduce
from string import Template

from django.db import router
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.endpoints.relocations import ERR_FEATURE_DISABLED
from sentry.api.exceptions import SuperuserRequired
from sentry.api.paginator import OffsetPaginator
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.relocation import RelocationSerializer
from sentry.models.files.file import File
from sentry.models.relocation import Relocation, RelocationFile
from sentry.models.user import MAX_USERNAME_LENGTH
from sentry.options import get
from sentry.search.utils import tokenize_query
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.slug.patterns import ORG_SLUG_PATTERN
from sentry.tasks.relocation import uploading_complete
from sentry.utils.db import atomic_transaction
from sentry.utils.relocation import RELOCATION_BLOB_SIZE, RELOCATION_FILE_TYPE

ERR_DUPLICATE_RELOCATION = "An in-progress relocation already exists for this owner."
ERR_INVALID_ORG_SLUG = Template("Org slug is invalid: `$org_slug`.")
ERR_INVALID_OWNER = Template(
    "Only your own username (`$creator_username`) can be set as the owner."
)
ERR_OWNER_NOT_FOUND = Template("Could not find user `$owner_username`.")
ERR_THROTTLED_RELOCATION = (
    "We've reached our daily limit of relocations - please try again tomorrow or contact support."
)
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


def should_throttle_relocation(relocation_bucket_size: str) -> bool:
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
        f"relocation.daily-limit.{relocation_bucket_size}"
    ):
        return False
    return True


class RelocationsPostSerializer(serializers.Serializer):
    file = serializers.FileField(required=True)
    orgs = serializers.CharField(required=True, allow_blank=False, allow_null=False)
    owner = serializers.CharField(
        max_length=MAX_USERNAME_LENGTH, required=True, allow_blank=False, allow_null=False
    )


def validate_new_relocation_request(
    request: Request, owner_username: str, org_slugs: list[str], file_size: int
) -> Response | None:
    # We only honor the `relocation.enabled` flag for non-superusers.
    try:
        is_superuser = SuperuserPermission().has_permission(request, None)
    except SuperuserRequired:
        is_superuser = False
    if not options.get("relocation.enabled") and not is_superuser:
        return Response({"detail": ERR_FEATURE_DISABLED}, status=status.HTTP_403_FORBIDDEN)

    # Only superusers can start relocations for other users.
    creator = user_service.get_user(user_id=request.user.id)
    if creator is None:
        raise RuntimeError("Could not ascertain request user's username")
    if not is_superuser and creator.username != owner_username:
        return Response(
            {"detail": ERR_INVALID_OWNER.substitute(creator_username=creator.username)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Validate org slug formatting.
    for org_slug in org_slugs:
        if not re.match(ORG_SLUG_PATTERN, org_slug):
            return Response(
                {"detail": ERR_INVALID_ORG_SLUG.substitute(org_slug=org_slug)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    # Regular users may be throttled, but superusers never are.
    relocation_size_category = get_relocation_size_category(file_size)
    if not is_superuser and should_throttle_relocation(relocation_size_category):
        return Response(
            {"detail": ERR_THROTTLED_RELOCATION},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    return None


def validate_relocation_uniqueness(owner: RpcUser) -> Response | None:
    # Check that this `owner` does not have more than one active `Relocation` in flight.
    if Relocation.objects.filter(
        owner_id=owner.id,
        status__in={Relocation.Status.IN_PROGRESS.value, Relocation.Status.PAUSE.value},
    ).exists():
        return Response({"detail": ERR_DUPLICATE_RELOCATION}, status=status.HTTP_409_CONFLICT)

    return None


def get_autopause_value() -> int | None:
    try:
        return Relocation.Step[options.get("relocation.autopause")].value
    except KeyError:
        return None


@region_silo_endpoint
class RelocationIndexEndpoint(Endpoint):
    owner = ApiOwner.OPEN_SOURCE
    publish_status = {
        # TODO(getsentry/team-ospo#214): Stabilize before GA.
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        """
        A list of relocations, ordered by creation date.
        ``````````````````````````````````````````````````

        :qparam string query: string to match in importing org slugs, username, or relocation UUID.
        :qparam string status: filter by status.

        :auth: required
        """

        logger.info("relocations.index.get.start", extra={"caller": request.user.id})

        if not SuperuserPermission().has_permission(request, None):
            return Response(status=status.HTTP_403_FORBIDDEN)

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
                stat = Relocation.Status[status_str.upper()]
            except KeyError:
                return Response(
                    {"detail": ERR_UNKNOWN_RELOCATION_STATUS.substitute(status=status_str)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            queryset = queryset.filter(status=stat.value)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
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

        logger.info("relocations.index.post.start", extra={"caller": request.user.id})

        serializer = RelocationsPostSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated = serializer.validated_data
        fileobj = validated.get("file")
        file_size = fileobj.size
        owner_username = validated.get("owner")
        org_slugs = [org.strip() for org in validated.get("orgs").split(",")]
        err = validate_new_relocation_request(request, owner_username, org_slugs, file_size)
        if err is not None:
            return err

        try:
            owner = user_service.get_by_username(username=owner_username)[0]
        except IndexError:
            return Response(
                {"detail": ERR_OWNER_NOT_FOUND.substitute(owner_username=owner_username)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        err = validate_relocation_uniqueness(owner)
        if err is not None:
            return err

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
                scheduled_pause_at_step=get_autopause_value(),
            )
            RelocationFile.objects.create(
                relocation=relocation,
                file=file,
                kind=RelocationFile.Kind.RAW_USER_DATA.value,
            )

        uploading_complete.delay(relocation.uuid)
        analytics.record(
            "relocation.created",
            creator_id=request.user.id,
            owner_id=owner.id,
            uuid=str(relocation.uuid),
        )
        return Response(serialize(relocation), status=status.HTTP_201_CREATED)
