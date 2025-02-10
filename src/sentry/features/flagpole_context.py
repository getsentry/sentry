from dataclasses import dataclass

from django.contrib.auth.models import AnonymousUser

from flagpole.evaluation_context import ContextBuilder, EvaluationContextDict
from sentry.hybridcloud.services.organization_mapping.model import RpcOrganizationMapping
from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.project import Project
from sentry.organizations.services.organization import RpcOrganization
from sentry.organizations.services.organization.model import RpcOrganizationSummary
from sentry.projects.services.project import RpcProject
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


class InvalidContextDataException(Exception):
    pass


@dataclass()
class SentryContextData:
    actor: User | RpcUser | AnonymousUser | None = None
    organization: (
        Organization
        | RpcOrganization
        | RpcOrganizationSummary
        | RpcOrganizationMapping
        | OrganizationMapping
        | None
    ) = None
    project: Project | RpcProject | None = None


def organization_context_transformer(data: SentryContextData) -> EvaluationContextDict:
    context_data: EvaluationContextDict = dict()
    org = data.organization
    if org is None:
        return context_data

    if isinstance(org, Organization):
        context_data["organization_slug"] = org.slug
        context_data["organization_name"] = org.name
        context_data["organization_id"] = org.id
        early_adopter = bool(org.flags.early_adopter) if org.flags is not None else False
        context_data["organization_is-early-adopter"] = early_adopter

    elif isinstance(org, OrganizationMapping):
        context_data["organization_slug"] = org.slug
        context_data["organization_name"] = org.name
        context_data["organization_id"] = org.organization_id
        context_data["organization_is-early-adopter"] = org.flags.early_adopter

    elif isinstance(org, RpcOrganization):
        context_data["organization_slug"] = org.slug
        context_data["organization_name"] = org.name
        context_data["organization_id"] = org.id
        context_data["organization_is-early-adopter"] = org.flags.early_adopter

    elif isinstance(org, RpcOrganizationSummary):
        context_data["organization_slug"] = org.slug
        context_data["organization_name"] = org.name
        context_data["organization_id"] = org.id
        context_data["organization_is-early-adopter"] = bool(org.flags.early_adopter)
    else:
        raise InvalidContextDataException("Invalid organization object provided")

    return context_data


def project_context_transformer(data: SentryContextData) -> EvaluationContextDict:
    context_data: EvaluationContextDict = dict()

    if (proj := data.project) is not None:
        if not isinstance(proj, Project):
            raise InvalidContextDataException("Invalid project object provided")

        context_data["project_slug"] = proj.slug
        context_data["project_name"] = proj.name
        context_data["project_id"] = proj.id

    return context_data


def user_context_transformer(data: SentryContextData) -> EvaluationContextDict:
    context_data: EvaluationContextDict = dict()
    user = data.actor
    if user is None or isinstance(user, AnonymousUser):
        return context_data

    if not isinstance(user, User) and not isinstance(user, RpcUser):
        raise InvalidContextDataException("Invalid actor object provided")

    if user.is_authenticated:
        context_data["user_id"] = user.id
        context_data["user_is-superuser"] = user.is_superuser
        context_data["user_is-staff"] = user.is_staff

    verified_emails: list[str]

    if isinstance(user, RpcUser):
        verified_emails = list(user.emails)
    else:
        verified_emails = list(user.get_verified_emails().values_list("email", flat=True))

    if user.email in verified_emails:
        context_data["user_email"] = user.email
        context_data["user_domain"] = user.email.rsplit("@", 1)[-1]

    return context_data


def get_sentry_flagpole_context_builder() -> ContextBuilder[SentryContextData]:
    """
    Creates and returns a new sentry flagpole context builder with Organization,
     User, and Project transformers appended to it.
    :return:
    """
    return (
        ContextBuilder[SentryContextData]()
        .add_context_transformer(organization_context_transformer, ["organization_id"])
        .add_context_transformer(project_context_transformer, ["project_id"])
        .add_context_transformer(user_context_transformer)
    )
