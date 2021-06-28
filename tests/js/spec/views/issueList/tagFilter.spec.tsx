import {fireEvent, mountWithTheme, waitFor} from 'sentry-test/reactTestingLibrary';

import IssueListTagFilter from 'app/views/issueList/tagFilter';

describe('IssueListTagFilter', function () {
  // @ts-expect-error
  MockApiClient.clearMockResponses();

  const selectMock = jest.fn();
  const tag = {key: 'browser', name: 'Browser'};
  const tagValueLoader: IssueListTagFilter['props']['tagValueLoader'] = () =>
    new Promise(resolve =>
      resolve([
        {
          count: 0,
          firstSeen: '2018-05-30T11:33:46.535Z',
          key: 'foo',
          lastSeen: '2018-05-30T11:33:46.535Z',
          name: 'foo',
          value: 'foo',
          id: 'foo',
          ip_address: '192.168.1.1',
          email: 'foo@boy.cat',
          username: 'foo',
        },
        {
          count: 0,
          firstSeen: '2018-05-30T11:33:46.535Z',
          key: 'fooBaar',
          lastSeen: '2018-05-30T11:33:46.535Z',
          name: 'fooBaar',
          value: 'fooBaar',
          id: 'fooBaar',
          ip_address: '192.168.1.1',
          email: 'fooBaar@boy.cat',
          username: 'ffooBaaroo',
        },
      ])
    );

  it('calls API and renders options when opened', async function () {
    const {getByLabelText, getByText, getAllByText} = mountWithTheme(
      <IssueListTagFilter
        tag={tag}
        value=""
        onSelect={selectMock}
        tagValueLoader={tagValueLoader}
      />
    );

    // changes dropdown input value
    const input = getByLabelText(tag.key);
    fireEvent.change(input, {target: {value: 'foo'}});

    // waits for the loading indicator to disappear
    const loadingIndicator = getByText('Loading\u2026');

    await waitFor(() => expect(loadingIndicator).not.toBeInTheDocument());

    // the result has a length of 2, because when performing a search,
    // an element containing the same value is present in the rendered HTML markup
    const allFoo = getAllByText('foo');

    // selects menu option
    const menuOptionFoo = allFoo[1];
    fireEvent.click(menuOptionFoo);

    expect(selectMock).toHaveBeenCalledWith(tag, 'foo');
  });
});
