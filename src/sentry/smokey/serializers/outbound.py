from sentry.api.serializers import Serializer, register, serialize
from sentry.smokey.models.incidentcase import IncidentCase
from sentry.smokey.models.incidentcasetemplate import IncidentCaseTemplate
from sentry.smokey.models.incidentcomponent import IncidentComponent


@register(IncidentCaseTemplate)
class IncidentCaseTemplateOutboundSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "name": obj.name,
            "case_handle": obj.case_handle,
            "severity_handle": obj.severity_handle,
            "severity_labels": obj.severity_labels,
            "case_lead_title": obj.case_lead_title,
            "update_frequency_minutes": obj.update_frequency_minutes,
            "schedule_provider": obj.schedule_provider,
            "schedule_config": obj.schedule_config,
            "task_provider": obj.task_provider,
            "task_config": obj.task_config,
            "channel_provider": obj.channel_provider,
            "channel_config": obj.channel_config,
            "status_page_provider": obj.status_page_provider,
            "status_page_config": obj.status_page_config,
            "retro_provider": obj.retro_provider,
            "retro_config": obj.retro_config,
        }


@register(IncidentComponent)
class IncidentComponentOutboundSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "name": obj.name,
            "description": obj.description,
            "status_page_component_id": obj.status_page_component_id,
            "parent_component": (
                self.serialize(obj.parent_component, attrs, user, **kwargs)
                if obj.parent_component
                else None
            ),
        }


@register(IncidentCase)
class IncidentCaseOutboundSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "title": obj.title,
            "started_at": obj.started_at,
            "resolved_at": obj.resolved_at,
            "status": obj.status,
            "severity": obj.severity,
            "description": obj.description,
            "summary": obj.summary,
            "template": serialize(obj.template),
            "case_lead": (serialize(obj.case_lead) if obj.case_lead else None),
            "affected_components": [
                serialize(component) for component in obj.affected_components.all()
            ],
            "schedule_record": obj.schedule_record,
            "task_record": obj.task_record,
            "channel_record": obj.channel_record,
            "status_page_record": obj.status_page_record,
            "retro_record": obj.retro_record,
        }
