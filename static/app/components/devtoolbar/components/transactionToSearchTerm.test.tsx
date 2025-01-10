import toSearchTerm from 'sentry/components/devtoolbar/components/transactionToSearchTerm';

describe('getSearchTerm', () => {
  it.each([
    {
      transactionName: '//alerts/rules/details/:ruleId/',
      searchTerm: '/alerts/rules/details/*/',
    },
    {transactionName: '/pokemon/[pokemonName]', searchTerm: '/pokemon/*/'},
    {transactionName: '/replays/<id>/details/', searchTerm: '/replays/*/details/'},
    {
      transactionName: '/param/{id}/param2/key:value/',
      searchTerm: '/param/*/param2/key:value/',
    },
    {transactionName: '/issues/4489703641/', searchTerm: '/issues/*/'},
    {
      transactionName: 'v1.3/tutorial/event/123',
      searchTerm: '/v1.3/tutorial/event/*/',
    },
    {
      transactionName: '/all/:id1/:id2/param',
      searchTerm: '/all/*/*/param/',
    },
    {
      transactionName: '//settings/account/emails/',
      searchTerm: '/settings/account/emails/',
    },
    {
      transactionName: '//settings/account/api/auth-tokens/new-token/',
      searchTerm: '/settings/account/api/auth-tokens/new-token/',
    },
    {
      transactionName: '/about/ps5/',
      searchTerm: '/about/ps5/',
    },
    {
      transactionName: '/',
      searchTerm: '/',
    },
  ])(
    'should get the correct search term from the transaction name',
    ({transactionName, searchTerm}: any) => {
      expect(toSearchTerm(transactionName)).toStrictEqual(searchTerm);
    }
  );
});
