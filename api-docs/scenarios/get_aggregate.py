# flake8: noqa

project = vars['teams'][0]['projects'][0]['project']
group = Group.objects.get(project=project)

request(
    method='GET',
    path='/groups/%s/' % group.id,
)
