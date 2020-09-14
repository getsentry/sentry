from __future__ import absolute_import

from django import template

from sentry import features

register = template.Library()


@register.tag
def feature(parser, token):
    bits = token.split_contents()
    if len(bits) < 2:
        raise template.TemplateSyntaxError(
            "%r tag requires an argument" % token.contents.split()[0]
        )

    name = bits[1]
    params = bits[2:]

    nodelist_true = parser.parse(("else", "endfeature"))
    token = parser.next_token()

    if token.contents == "else":
        nodelist_false = parser.parse(("endfeature",))
        parser.delete_first_token()
    else:
        nodelist_false = template.NodeList()

    return FeatureNode(nodelist_true, nodelist_false, name, params)


class FeatureNode(template.Node):
    def __init__(self, nodelist_true, nodelist_false, name, params):
        self.nodelist_true = nodelist_true
        self.nodelist_false = nodelist_false
        self.name = name
        self.params = [template.Variable(i) for i in params]

    def render(self, context):
        params = [i.resolve(context) for i in self.params]
        if "request" in context:
            user = context["request"].user
        else:
            user = None

        if not features.has(self.name, actor=user, *params):
            return self.nodelist_false.render(context)

        return self.nodelist_true.render(context)
