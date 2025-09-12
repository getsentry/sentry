export function translateAggregateTag(aggregate: string) {
  // Translate tags[sentry:user] to user
  if (aggregate.includes('tags[sentry:user]')) {
    return aggregate.replace('tags[sentry:user]', 'user');
  }

  return aggregate;
}

export function translateAggregateTagBack(aggregate: string) {
  // Translate user to tags[sentry:user]
  if (aggregate.includes('user')) {
    return aggregate.replace('user', 'tags[sentry:user]');
  }

  return aggregate;
}
