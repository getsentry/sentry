from sentry.incidents.models import AlertRule, AlertRuleActivity, AlertRuleActivityType
from sentry.models import User


AlertRuleActivity.objects.all().delete()

user = User.objects.all().first()
r = AlertRule.objects.all().first()
print("r.id:", r.id)
print("r.cb:", r.created_by)

AlertRuleActivity.objects.create(alert_rule=r, user=user, type=AlertRuleActivityType.UPDATED.value)

print("r.cb:", r.created_by)
AlertRuleActivity.objects.create(alert_rule=r, user=user, type=AlertRuleActivityType.CREATED.value)

print("r.cb:", r.created_by)

print("fresh")
r = AlertRule.objects.all().first()
print("r.id:", r.id)
print("r.cb:", r.created_by)
