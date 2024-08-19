from sentry.taskworker.config import taskregistry

demotasks = taskregistry.create_namespace(
    name="demos", topic="hackweek", deadletter_topic="hackweek-dlq", retry=None
)


@demotasks.register(name="taskdemo.hello")
def say_hello(name):
    print(f"hello {name}")
