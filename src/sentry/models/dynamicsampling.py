import hashlib
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence

from django.db import connections, models, router, transaction
from django.db.models import Q
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.utils import json, metrics

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project

# max number of custom rules that can be created per organization
MAX_CUSTOM_RULES = 2000
CUSTOM_RULE_START = 3000
MAX_CUSTOM_RULES_PER_PROJECT = 50
CUSTOM_RULE_DATE_FORMAT = "%Y-%m-%dT%H:%M:%S.%fZ"


class TooManyRules(ValueError):
    """
    Raised when a there is already the max number of rules active for an organization
    """

    pass


def get_rule_hash(condition: Any, project_ids: Sequence[int]) -> str:
    """
    Returns the hash of the rule based on the condition and projects
    """
    condition_string = to_order_independent_string(condition)
    project_string = to_order_independent_string(list(project_ids))
    rule_string = f"{condition_string}-{project_string}"
    # make it a bit shorter
    return hashlib.sha1(rule_string.encode("utf-8")).hexdigest()


def to_order_independent_string(val: Any) -> str:
    """
    Converts a value in an order independent string and then hashes it

    Note: this will insure the same repr is generated for ['x', 'y'] and ['y', 'x']
        Also the same repr is generated for {'x': 1, 'y': 2} and {'y': 2, 'x': 1}
    """
    ret_val = ""
    if isinstance(val, Mapping):
        for key in sorted(val.keys()):
            ret_val += f"{key}:{to_order_independent_string(val[key])}-"
    elif isinstance(val, (list, tuple)):
        vals = sorted([to_order_independent_string(item) for item in val])
        for item in vals:
            ret_val += f"{item}-"
    else:
        ret_val = str(val)
    return ret_val


@region_silo_only_model
class CustomDynamicSamplingRuleProject(Model):
    """
    Many-to-many relationship between a custom dynamic sampling rule and a project.
    """

    __relocation_scope__ = RelocationScope.Organization

    custom_dynamic_sampling_rule = FlexibleForeignKey(
        "sentry.CustomDynamicSamplingRule", on_delete=models.CASCADE
    )
    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_customdynamicsamplingruleproject"
        unique_together = (("custom_dynamic_sampling_rule", "project"),)


@region_silo_only_model
class CustomDynamicSamplingRule(Model):
    """
    This represents a custom dynamic sampling rule that is created by the user based
    on a query (a.k.a. investigation rule).

    """

    __relocation_scope__ = RelocationScope.Organization

    date_added = models.DateTimeField(default=timezone.now)
    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    projects = models.ManyToManyField(
        "sentry.Project",
        related_name="custom_dynamic_sampling_rules",
        through=CustomDynamicSamplingRuleProject,
    )
    is_active = models.BooleanField(default=True)
    is_org_level = models.BooleanField(default=False)
    rule_id = models.IntegerField(default=0)
    condition = models.TextField()
    sample_rate = models.FloatField(default=0.0)
    start_date = models.DateTimeField(default=timezone.now)
    end_date = models.DateTimeField()
    num_samples = models.IntegerField()
    condition_hash = models.CharField(max_length=40)
    # the raw query field from the request
    query = models.TextField(null=True)
    created_by_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE", null=True, blank=True)
    notification_sent = models.BooleanField(null=True, blank=True)

    @property
    def external_rule_id(self) -> int:
        """
        Returns the external rule id

        For external users, i.e. Relay, we need to shift the ids since the slot we
        have allocated starts at the offset specified in RESERVED_IDS.
        """
        return self.rule_id + CUSTOM_RULE_START

    class Meta:
        app_label = "sentry"
        db_table = "sentry_customdynamicsamplingrule"
        indexes = [
            # get active rules for an organization
            models.Index(fields=["organization"], name="org_idx", condition=Q(is_active=True)),
            # get expired rules (that are still marked as active)
            models.Index(fields=["end_date"], name="end_date_idx", condition=Q(is_active=True)),
            # find active rules for a condition
            models.Index(
                fields=["condition_hash"], name="condition_hash_idx", condition=Q(is_active=True)
            ),
        ]

    @staticmethod
    def get_rule_for_org(
        condition: Any,
        organization_id: int,
        project_ids: Sequence[int],
    ) -> Optional["CustomDynamicSamplingRule"]:
        """
        Returns an active rule for the given condition and organization if it exists otherwise None

        Note: There should not be more than one active rule for a given condition and organization
        This function doesn't verify this condition, it just returns the first one.
        """
        rule_hash = get_rule_hash(condition, project_ids)
        rules = CustomDynamicSamplingRule.objects.filter(
            organization_id=organization_id,
            condition_hash=rule_hash,
            is_active=True,
            end_date__gt=timezone.now(),
        )[:1]

        return rules[0] if rules else None

    @staticmethod
    def update_or_create(
        condition: Any,
        start: datetime,
        end: datetime,
        project_ids: Sequence[int],
        organization_id: int,
        num_samples: int,
        sample_rate: float,
        query: str,
        created_by_id: Optional[int] = None,
    ) -> "CustomDynamicSamplingRule":
        from sentry.models.organization import Organization
        from sentry.models.project import Project

        with transaction.atomic(router.db_for_write(CustomDynamicSamplingRule)):
            # check if rule already exists for this organization
            existing_rule = CustomDynamicSamplingRule.get_rule_for_org(
                condition, organization_id, project_ids
            )

            if existing_rule is not None:
                # we already have an active rule for this condition and this organization
                # update the expiration date and ensure that our projects are included
                existing_rule.end_date = max(end, existing_rule.end_date)
                existing_rule.num_samples = max(num_samples, existing_rule.num_samples)
                existing_rule.sample_rate = max(sample_rate, existing_rule.sample_rate)

                # for org rules we don't need to do anything with the projects
                existing_rule.save()
                return existing_rule
            else:
                projects = Project.objects.get_many_from_cache(project_ids)
                projects = list(projects)
                organization = Organization.objects.get_from_cache(id=organization_id)

                if CustomDynamicSamplingRule.per_project_limit_reached(projects, organization):
                    raise TooManyRules()

                # create a new rule
                rule_hash = get_rule_hash(condition, project_ids)
                is_org_level = len(project_ids) == 0
                condition_str = json.dumps(condition)
                rule = CustomDynamicSamplingRule.objects.create(
                    organization_id=organization_id,
                    condition=condition_str,
                    sample_rate=sample_rate,
                    start_date=start,
                    end_date=end,
                    num_samples=num_samples,
                    condition_hash=rule_hash,
                    is_active=True,
                    is_org_level=is_org_level,
                    query=query,
                    notification_sent=False,
                    created_by_id=created_by_id,
                )

                rule.save()
                # now try to assign a rule id
                id = rule.assign_rule_id()
                if id > MAX_CUSTOM_RULES:
                    # we have too many rules, delete this one
                    rule.delete()
                    raise TooManyRules()

                # set the projects if not org level
                for project in projects:
                    CustomDynamicSamplingRuleProject.objects.create(
                        custom_dynamic_sampling_rule=rule, project=project
                    )
                return rule

    def assign_rule_id(self) -> int:
        """
        Assigns the smallest rule id that is not taken in the
        current organization.
        """
        table_name = self._meta.db_table
        if self.id is None:
            raise ValueError("Cannot assign rule id to unsaved object")
        if self.rule_id != 0:
            raise ValueError("Cannot assign rule id to object that already has a rule id")

        now = timezone.now()

        raw_sql = (
            f"UPDATE {table_name} SET rule_id = ( "
            f"   SELECT COALESCE ((SELECT MIN(rule_id) + 1  FROM {table_name} WHERE rule_id + 1 NOT IN ("
            f"       SELECT rule_id FROM {table_name} WHERE organization_id = %s AND end_date > %s AND "
            f"is_active)),1))  "
            f"WHERE id = %s"
        )
        with connections["default"].cursor() as cursor:
            cursor.execute(raw_sql, (self.organization.id, now, self.id))
        self.refresh_from_db()
        return self.rule_id

    @staticmethod
    def deactivate_old_rules() -> None:
        """
        Deactivates all rules expired rules (this is just an optimization to remove old rules from indexes).

        This should be called periodically to clean up old rules (it is not necessary to call it for correctness,
        just for performance)
        """
        CustomDynamicSamplingRule.objects.filter(
            # give it a minute grace period to make sure we don't deactivate rules that are still active
            end_date__lt=timezone.now()
            - timedelta(minutes=1),
        ).update(is_active=False)

    @staticmethod
    def get_project_rules(
        project: "Project",
    ) -> Sequence["CustomDynamicSamplingRule"]:
        """
        Returns all active project rules
        """
        now = timezone.now()
        # org rules ( apply to all projects in the org)
        org_rules = CustomDynamicSamplingRule.objects.filter(
            is_active=True,
            is_org_level=True,
            organization=project.organization,
            end_date__gt=now,
            start_date__lt=now,
        )[: MAX_CUSTOM_RULES_PER_PROJECT + 1]

        # project rules
        project_rules = CustomDynamicSamplingRule.objects.filter(
            is_active=True,
            projects__in=[project],
            end_date__gt=now,
            start_date__lt=now,
        )[: MAX_CUSTOM_RULES_PER_PROJECT + 1]

        rules = project_rules.union(org_rules)[: MAX_CUSTOM_RULES_PER_PROJECT + 1]
        rules = list(rules)

        if len(rules) > MAX_CUSTOM_RULES_PER_PROJECT:
            metrics.incr("dynamic_sampling.custom_rules.overflow")

        return rules[:MAX_CUSTOM_RULES_PER_PROJECT]

    @staticmethod
    def deactivate_expired_rules():
        """
        Deactivates all rules that have expired
        """
        CustomDynamicSamplingRule.objects.filter(
            end_date__lt=timezone.now(), is_active=True
        ).update(is_active=False)

    @staticmethod
    def num_active_rules_for_project(project: "Project") -> int:
        """
        Returns the number of active rules for the given project
        """
        now = timezone.now()

        num_org_rules = CustomDynamicSamplingRule.objects.filter(
            is_active=True,
            is_org_level=True,
            organization=project.organization,
            end_date__gt=now,
            start_date__lte=now,
        ).count()

        num_proj_rules = CustomDynamicSamplingRule.objects.filter(
            is_active=True,
            is_org_level=False,
            projects__in=[project],
            end_date__gt=now,
            start_date__lte=now,
        ).count()

        return num_proj_rules + num_org_rules

    @staticmethod
    def per_project_limit_reached(
        projects: Sequence["Project"], organization: "Organization"
    ) -> bool:
        """
        Returns True if the rule limit is reached for any of the given projects (or all
        the projects in the organization if org level rule)
        """
        projects = list(projects)
        if len(projects) == 0:
            # an org rule check all the org projects
            org_projects = organization.project_set.filter(status=ObjectStatus.ACTIVE)
            projects = list(org_projects)
        for project in projects:
            num_rules = CustomDynamicSamplingRule.num_active_rules_for_project(project)
            if num_rules >= MAX_CUSTOM_RULES_PER_PROJECT:
                return True
        return False
