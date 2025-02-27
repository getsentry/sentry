import logging
from string import Template

from django.db import router
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import capture_exception

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import SuperuserOrStaffFeatureFlaggedPermission
from sentry.api.serializers import serialize
from sentry.hybridcloud.services.organization_mapping import organization_mapping_service
from sentry.models.organization import OrganizationStatus
from sentry.relocation.api.endpoints.index import (
    get_autopause_value,
    validate_relocation_uniqueness,
)
from sentry.relocation.models.relocation import Relocation
from sentry.relocation.tasks.process import uploading_start
from sentry.types.region import get_local_region
from sentry.utils.db import atomic_transaction

ERR_DUPLICATE_ORGANIZATION_FORK = Template(
    "This organization is already in the process of being forked, relocation id: $uuid"
)
ERR_ORGANIZATION_NOT_FOUND = Template("The target organization `$pointer` could not be found.")
ERR_ORGANIZATION_INACTIVE = Template(
    "The target organization `$slug` has status `$status`; status can only be `ACTIVE`."
)
ERR_CANNOT_FORK_INTO_SAME_REGION = Template(
    "The organization already lives in region `$region`, so it cannot be forked into that region."
)
ERR_CANNOT_FORK_FROM_REGION = Template(
    "Forking an organization from region `$region` is forbidden."
)

# For legal reasons, there are certain regions from which forking is disallowed.
CANNOT_FORK_FROM_REGION = {"de"}

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationForkEndpoint(Endpoint):
    owner = ApiOwner.OPEN_SOURCE
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (SuperuserOrStaffFeatureFlaggedPermission,)

    def post(self, request: Request, organization_id_or_slug) -> Response:
        """
        Duplicate an organization across regions. The old organization remains untouched. We kick
        off the standard `SAAS_TO_SAAS` relocation flow to create a duplicate in this region.

        Because each region silo of the API has its own version of this endpoint, we assume that the
        target region for the fork is the owning region of the API on which this was called. For
        example, if we call this endpoint at `us.sentry.io`, we are implicitly saying we would like
        the target organization forked INTO the `us` region.
        ``````````````````````````````````````````````````

        :pparam string org_slug: the id or slug of the organization

        :auth: required
        """

        logger.info("relocations.fork.post.start", extra={"caller": request.user.id})

        org_mapping = (
            organization_mapping_service.get(organization_id=organization_id_or_slug)
            if str(organization_id_or_slug).isdecimal()
            else organization_mapping_service.get_by_slug(slug=organization_id_or_slug)
        )
        if not org_mapping:
            return Response(
                {
                    "detail": ERR_ORGANIZATION_NOT_FOUND.substitute(
                        pointer=organization_id_or_slug,
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        if org_mapping.status != OrganizationStatus.ACTIVE:
            return Response(
                {
                    "detail": ERR_ORGANIZATION_INACTIVE.substitute(
                        slug=org_mapping.slug,
                        status=str(OrganizationStatus(org_mapping.status or 0).name),
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Figure out which region the organization being forked lives in.
        requesting_region_name = get_local_region().name
        replying_region_name = org_mapping.region_name
        if replying_region_name in CANNOT_FORK_FROM_REGION:
            return Response(
                {
                    "detail": ERR_CANNOT_FORK_FROM_REGION.substitute(
                        region=replying_region_name,
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if replying_region_name == requesting_region_name:
            return Response(
                {
                    "detail": ERR_CANNOT_FORK_INTO_SAME_REGION.substitute(
                        region=requesting_region_name,
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # If there is an in-progress relocation into this region with for this org already, block
        # this one until that one resolves.
        duplicate_relocation = Relocation.objects.filter(
            provenance=Relocation.Provenance.SAAS_TO_SAAS.value,
            want_org_slugs=[org_mapping.slug],
            status__in={Relocation.Status.IN_PROGRESS.value, Relocation.Status.PAUSE.value},
        ).first()
        if duplicate_relocation is not None:
            return Response(
                {
                    "detail": ERR_DUPLICATE_ORGANIZATION_FORK.substitute(
                        uuid=duplicate_relocation.uuid
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Identify who will be the owner of the newly forked organization, and ensure that they
        # don't already have relocations in flight.
        owners = organization_mapping_service.get_owners(organization_id=org_mapping.id)
        owner = owners[0] if len(owners) > 0 else request.user
        err = validate_relocation_uniqueness(owner)
        if err is not None:
            return err

        # We do not create a `RelocationFile` yet. Instead, we trigger a series of RPC calls (via
        # `uploading_start`, scheduled below) to create an export of the organization we are seeking
        # duplicate from the foreign region.
        provenance = Relocation.Provenance.SAAS_TO_SAAS
        with atomic_transaction(using=(router.db_for_write(Relocation))):
            new_relocation: Relocation = Relocation.objects.create(
                creator_id=request.user.id,
                owner_id=owner.id,
                step=Relocation.Step.UPLOADING.value,
                scheduled_pause_at_step=get_autopause_value(provenance),
                provenance=provenance,
                want_org_slugs=[org_mapping.slug],
            )

        # Kick off the asynchronous process of exporting the relocation from the partner region.
        # When we received this back (via RPC call), we'll be able to continue with the usual
        # relocation flow, picking up from the `uploading_complete` task.
        uploading_start.apply_async(
            args=[new_relocation.uuid, replying_region_name, org_mapping.slug]
        )

        try:
            analytics.record(
                "relocation.forked",
                creator_id=request.user.id,
                owner_id=owner.id,
                uuid=str(new_relocation.uuid),
                from_org_slug=org_mapping.slug,
                requesting_region_name=requesting_region_name,
                replying_region_name=replying_region_name,
            )
        except Exception as e:
            capture_exception(e)

        return Response(serialize(new_relocation), status=status.HTTP_201_CREATED)
