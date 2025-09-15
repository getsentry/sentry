export function translateAggregateTag(aggregate: string) {
  // Translate count_unique(tags[sentry:user]) to count_unique(user)
  if (aggregate.includes('(tags[sentry:user])')) {
    return aggregate.replace('(tags[sentry:user])', '(user)');
  }

  return aggregate;
}

export function translateAggregateTagBack(aggregate: string) {
  // Translate count_unique(user) to count_unique(tags[sentry:user])
  if (aggregate.includes('(user)')) {
    return aggregate.replace('(user)', '(tags[sentry:user])');
  }

  return aggregate;
}
