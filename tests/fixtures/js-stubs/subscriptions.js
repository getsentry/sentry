export function Subscriptions(params = []) {
  return [
    {
      subscribedDate: '2018-01-08T05:14:59.102Z',
      subscribed: true,
      listDescription:
        'Everything you need to know about Sentry features, integrations, partnerships, and launches.',
      listId: 2,
      unsubscribedDate: null,
      listName: 'Product & Feature Updates',
      email: 'test@sentry.io',
    },
    {
      subscribedDate: null,
      subscribed: false,
      listDescription: "Our monthly update on what's new with Sentry and the community.",
      listId: 1,
      unsubscribedDate: '2018-01-08T19:31:42.546Z',
      listName: 'Sentry Newsletter',
      email: 'test@sentry.io',
    },
    ...params,
  ];
}
