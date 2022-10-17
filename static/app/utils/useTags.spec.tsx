import {reactHooks} from 'sentry-test/reactTestingLibrary';

import TagStore from 'sentry/stores/tagStore';
import useTags from 'sentry/utils/useTags';

describe('useTags', function () {
  beforeEach(() => {
    TagStore.reset();
  });

  it('provides tags from the tag store', function () {
    reactHooks.act(
      () => void TagStore.loadTagsSuccess([{name: 'Mechanism', key: 'mechanism'}])
    );

    const {result} = reactHooks.renderHook(useTags);
    const {tags} = result.current;

    const expected = {mechanism: {name: 'Mechanism', key: 'mechanism', values: []}};
    expect(tags).toEqual(expected);
  });
});
