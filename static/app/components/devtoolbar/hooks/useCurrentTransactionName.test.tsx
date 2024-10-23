import {toSearchTerm} from 'sentry/components/devtoolbar/hooks/useCurrentTransactionName';

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
      transactionName: '/all/:id1/:id2/param',
      searchTerm: '/all/*/*/param/',
    },
  ])(
    'should get the correct search term from the transaction name',
    ({transactionName, searchTerm}) => {
      expect(toSearchTerm(transactionName)).toStrictEqual(searchTerm);
    }
  );
});
