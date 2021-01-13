from sentry.incidents.models import AlertRule, Incident, IncidentType, IncidentSnapshot, TimeSeriesSnapshot, IncidentSeen
from sentry.incidents.logic import create_incident
from sentry.models import Organization, Project, User
from datetime import datetime
import pytz

date_format = "%Y-%m-%d %H:%M"
start_date = datetime.strptime("2020-06-09 11:09", date_format).replace(tzinfo=pytz.utc)
detected_date = datetime.strptime("2020-06-09 11:11", date_format).replace(tzinfo=pytz.utc)
end_date = datetime.strptime("2020-06-09 11:13", date_format).replace(tzinfo=pytz.utc)

org = Organization.objects.filter(slug="default").last()
user = User.objects.all().first()
projects = Project.objects.filter(organization=org, slug="fire")

rule = AlertRule.objects.all().last()
rule.dataset="events"
rule.aggregate = "count()"
rule.query=""
rule.name="testing activity"
# rule.query="transaction:/api/0/organizations/{organization_slug}/eventsv2/"
rule.save()
incident = create_incident(
    organization = org,
    type_ = IncidentType.ALERT_TRIGGERED,
    title = rule.name,
    date_started=start_date,
    date_detected=detected_date,
    alert_rule=rule,
    projects=projects,
)

print("incident:", incident)
print("incident.identifier:", incident.identifier)
# # user_no_org = User.objects.create(username="meow")
# user_no_org = User.objects.get(username="meow")
# # seen = IncidentSeen.objects.create(incident=incident, user=user, last_seen=start_date)
# seen = IncidentSeen.objects.create(incident=incident, user=user_no_org, last_seen=start_date)
# print("seen:", seen)
# user = User.objects.all().first()
# seen = IncidentSeen.objects.create(incident=incident, user    =user, last_seen=start_date)


# tracked_views = IncidentSeen.objects.all().select_related("user", "incident")
# for tracked_view in tracked_views:
#     tracked_user = tracked_view.user
#     tracked_incident = tracked_view.incident
#     org = tracked_incident.organization
#     print("org:",org)
#     print("org:",org.id)
#     print("org:",org.status)
#     print("org:",org.members)
#     print("org:",dir(org))
#     # print("org:",Organization.get_default())
#     # print("org:",org.get_default())
#     is_org_member = org.has_access(tracked_user)
#     print("is org member:",is_org_member)
#     # if not is_org_member:
#         # tracked_view.delete()
# ` ` `

# Management takes pride in working until really late regularly (midnight or later) and asks employee's to do the same, and also asked to work weekends. They want you to have a personal stake in the company, without actually giving you any equity or incentive to do so (often worded to make it sound like you're a bad person for not helping out when they're in need).

# Very little room for growth. Maybe it has happened, but I've never heard of a developer actually getting a raise.

# Really high turnover rate. Most of the good devs quit as soon as they can.

# You'll be asked to switch your statutory holidays nearly every time on a 1:1 basis (which doesn't make sense because the time off on the actual holiday is more valuable) - making it hard to spend your long weekends with friends or family.

# Penny pinches - pays you as little as possible. Developers doing the same work are paid drastically different amounts based on how much he was able to take advantage of you at hiring, or how well you know your own worth.

# Forced to time all your tasks to the minute, and write reports on your work so management knows what you're doing (because they otherwise have no idea). Time pressure is real.

# No benefits. Just pray you don't get sick or get a cavity.

# Technically unsatisfying development. You fight with and develop on BigCommerce (not developer friendly) through javascript injections on the regular. Often write hacky PHP scripts or place Javascript hacks in the BigCommerce footer section to solve problems. Newer apps are written in Angular. You don't get the time, or opportunity to write code you're proud of. "Just make it work" and "Can you fix it?" are common to hear from management.

# No dev ops process - no tests, CI/CD, PRs, or reviews of any kind.

# One SVN repo account is shared between all developers, and for the newer work, Git is used very poorly. A new feature is often added to various branches manually instead of using a master and a merge/rebase system. You won't get any good experience for your next job around this.

# Management is passive aggressive directly, and indirectly insults all employees behind their backs.

# Camera in dev cave so management can monitor you (So they can "see if you're at your desk" so management doesn't have to walk over for nothing).

# Many promises made, never fulfilled. Tries to get free work by offering revenue share on apps - no one has ever made money doing this as far as I know, but management has gotten free work.

# Pay made by cheque (2020 and no automatic payroll or eTransfer for a technically inclined company?) and often late. Wait after hours on Friday when they hop into a 5PM meeting to be told afterwards that it won't come until Monday or the CEO's "wife is on the way" with the cheques and you can wait or leave. And after you quit? Ex-employees have had to wait long times to get their final cheque, and I know of one who had to fight to get the full amount (and didn't).

# I know of an ex-employee that they wouldn't provide a reference for after >2 years of work.

# Senior devs don't cooperate - they've actually formed two companies (MiniBC and Be a Part Of) and sometimes have competing interest.

# "Kitchen area" has no running water, a really dirty toaster oven and old microwave, and two fridges usually full with some gross leftovers from management. I'm not sure if many employees were actually using this. 

# I've seen (and heard) management yell and swear at employees. Very disrespectful.

# Treated like robots, not humans.



# I'm sure this isn't the worst place to work at, but I've worked at a number of companies and it is by far the  the worst place to be employed that I've ever personally encountered. I just want to warn people what they're getting into! Join at your own risk knowing this!
# ```
# i = Incident.objects.get(id=51)
# isnap = IncidentSnapshot.objects.get(incident_id=51)
# tss = TimeSeriesSnapshot.objects.get(id=2)
# # tss = TimeSeriesSnapshot.objects.create(
# #     start=start_date,
# #     end=end_date,
# #     values = [[1582801688,20],[1582801692,42],[1582801696,53],[1582801700,62],[1582801704,62],[1582801708,59],[1582801712,56],[1582801716,68],[1582801720,78],[1582801724,61],[1582801728,75],[1582801732,56],[1582801736,42],[1582801740,51],[1582801744,53],[1582801748,56],[1582801752,65],[1582801756,72],[1582801760,65],[1582801764,72],[1582801768,67],[1582801772,77],[1582801776,76],[1582801780,86],[1582801784,81],[1582801788,84],[1582801792,77],[1582801796,75],[1582801800,58],[1582801804,57],[1582801808,65],[1582801812,54],[1582801816,58],[1582801820,66],[1582801824,52],[1582801828,61],[1582801832,66],[1582801836,70],[1582801840,77],[1582801844,71],[1582801848,83],[1582801852,69],[1582801856,74],[1582801860,65],[1582801864,59],[1582801868,80],[1582801872,73],[1582801876,75],[1582801880,80],[1582801884,73],[1582801888,57],[1582801892,71],[1582801896,64],[1582801900,80],[1582801904,73],[1582801908,80],[1582801912,72],[1582801916,50],[1582801920,46],[1582801924,55],[1582801928,47],[1582801932,38],[1582801936,30],[1582801940,41],[1582801944,42],[1582801948,38],[1582801952,37],[1582801956,44],[1582801960,44],[1582801964,42],[1582801968,30],[1582801972,33],[1582801976,35],[1582801980,24]],
# #     period = 4,
# #     date_added=end_date
# # )
# # isnap = IncidentSnapshot.objects.create(
# #     incident_id=51,
# #     unique_users="1234",
# #     total_events="13337",
# #     date_added=end_date,
# #     event_stats_snapshot = tss
# # )

# # i.aggregation = 1
# # i.date_started = start_date
# # i.date_ended = end_date
# # i.save()

# # # isnap.date_added = end_date
# # # isnap.save()

# tss.period = 4
# tss.start = start_date  # - calculate_incident_prewindow(start_date, end_date, i)
# tss.end = end_date
# tss.date_added = end_date
# tss.values = [
#     [1582801688, 20],
#     [1582801692, 42],
#     [1582801696, 53],
#     [1582801700, 62],
#     [1582801704, 62],
#     [1582801708, 59],
#     [1582801712, 56],
#     [1582801716, 68],
#     [1582801720, 78],
#     [1582801724, 61],
#     [1582801728, 75],
#     [1582801732, 56],
#     [1582801736, 42],
#     [1582801740, 51],
#     [1582801744, 53],
#     [1582801748, 56],
#     [1582801752, 65],
#     [1582801756, 72],
#     [1582801760, 65],
#     [1582801764, 72],
#     [1582801768, 67],
#     [1582801772, 77],
#     [1582801776, 76],
#     [1582801780, 86],
#     [1582801784, 81],
#     [1582801788, 84],
#     [1582801792, 77],
#     [1582801796, 75],
#     [1582801800, 58],
#     [1582801804, 57],
#     [1582801808, 65],
#     [1582801812, 54],
#     [1582801816, 58],
#     [1582801820, 66],
#     [1582801824, 52],
#     [1582801828, 61],
#     [1582801832, 66],
#     [1582801836, 70],
#     [1582801840, 77],
#     [1582801844, 71],
#     [1582801848, 83],
#     [1582801852, 69],
#     [1582801856, 74],
#     [1582801860, 65],
#     [1582801864, 59],
#     [1582801868, 80],
#     [1582801872, 73],
#     [1582801876, 75],
#     [1582801880, 80],
#     [1582801884, 73],
#     [1582801888, 57],
#     [1582801892, 71],
#     [1582801896, 64],
#     [1582801900, 80],
#     [1582801904, 73],
#     [1582801908, 80],
#     [1582801912, 72],
#     [1582801916, 50],
#     [1582801920, 46],
#     [1582801924, 55],
#     [1582801928, 47],
#     [1582801932, 38],
#     [1582801936, 30],
#     [1582801940, 41],
#     [1582801944, 42],
#     [1582801948, 38],
#     [1582801952, 37],
#     [1582801956, 44],
#     [1582801960, 44],
#     [1582801964, 42],
#     [1582801968, 30],
#     [1582801972, 33],
#     [1582801976, 35],
#     [1582801980, 24],
# ]
# tss.save()

# from sentry.utils.dates import to_timestamp
# import six
# # from sentry.api.serializers.snuba import zerofill
# def zerofill(data, start, end, rollup):
#     print("Zerofilling!",data,start,end,rollup)
#     rv = []
#     start = data[0][0] # ((int(to_timestamp(start)) / rollup) * rollup) - rollup
#     end = data[-1][0] # ((int(to_timestamp(end)) / rollup) * rollup) + rollup
#     print("new start:",start)
#     print("new end:",end)
#     i = 0
#     for key in six.moves.xrange(start, end, rollup):
#         print("i is:",i)
#         print("key is:",key)
#         # if key == 1582801980:
#             # import pdb;pdb.set_trace()
#         try:
#             print("data[i][0]",data[i][0])
#             if data[i][0] == key:
#                 print("appending.")
#                 rv.append(data[i])
#                 i += 1
#                 continue
#         except IndexError:
#             pass

#         rv.append((key, []))
#     print("returning:",rv)
#     return rv


# zerofill(
#     [
#         (1582801688, [{'count': 20}]),
#         (1582801692, [{'count': 42}]),
#         (1582801696, [{'count': 53}]),
#         (1582801700, [{'count': 62}]),
#         (1582801704, [{'count': 62}]),
#         (1582801708, [{'count': 59}]),
#         (1582801712, [{'count': 56}]),
#         (1582801716, [{'count': 68}]),
#         (1582801720, [{'count': 78}]),
#         (1582801724, [{'count': 61}]),
#         (1582801728, [{'count': 75}]),
#         (1582801732, [{'count': 56}]),


#         (1582801736, [{'count': 42}]), (1582801740, [{'count': 51}]), (1582801744, [{'count': 53}]), (1582801748, [{'count': 56}]), (1582801752, [{'count': 65}]), (1582801756, [{'count': 72}]), (1582801760, [{'count': 65}]), (1582801764, [{'count': 72}]), (1582801768, [{'count': 67}]), (1582801772, [{'count': 77}]), (1582801776, [{'count': 76}]), (1582801780, [{'count': 86}]), (1582801784, [{'count': 81}]), (1582801788, [{'count': 84}]), (1582801792, [{'count': 77}]), (1582801796, [{'count': 75}]), (1582801800, [{'count': 58}]), (1582801804, [{'count': 57}]), (1582801808, [{'count': 65}]), (1582801812, [{'count': 54}]), (1582801816, [{'count': 58}]), (1582801820, [{'count': 66}]), (1582801824, [{'count': 52}]), (1582801828, [{'count': 61}]), (1582801832, [{'count': 66}]), (1582801836, [{'count': 70}]), (1582801840, [{'count': 77}]), (1582801844, [{'count': 71}]), (1582801848, [{'count': 83}]), (1582801852, [{'count': 69}]), (1582801856, [{'count': 74}]), (1582801860, [{'count': 65}]), (1582801864, [{'count': 59}]), (1582801868, [{'count': 80}]), (1582801872, [{'count': 73}]), (1582801876, [{'count': 75}]), (1582801880, [{'count': 80}]), (1582801884, [{'count': 73}]), (1582801888, [{'count': 57}]), (1582801892, [{'count': 71}]), (1582801896, [{'count': 64}]), (1582801900, [{'count': 80}]), (1582801904, [{'count': 73}]), (1582801908, [{'count': 80}]), (1582801912, [{'count': 72}]), (1582801916, [{'count': 50}]), (1582801920, [{'count': 46}]), (1582801924, [{'count': 55}]), (1582801928, [{'count': 47}]), (1582801932, [{'count': 38}]), (1582801936, [{'count': 30}]), (1582801940, [{'count': 41}]), (1582801944, [{'count': 42}]), (1582801948, [{'count': 38}]), (1582801952, [{'count': 37}]), (1582801956, [{'count': 44}]), (1582801960, [{'count': 44}]), (1582801964, [{'count': 42}]), (1582801968, [{'count': 30}]), (1582801972, [{'count': 33}]), (1582801976, [{'count': 35}]), (1582801980, [{'count': 24}])
#     ],

#         datetime(2020, 2, 27, 11, 9, tzinfo=pytz.utc), # - calculate_incident_prewindow(start, end, incident),
#         datetime(2020, 2, 27, 11, 13, tzinfo=pytz.utc),
#         4
#     )
