import {findActiveTrigger} from './matching';

describe('restricted composer triggers', () => {
  it.each(['hello /new', ' /new', '\n/new'])(
    'rejects a command after other text in %j',
    text => {
      expect(
        findActiveTrigger(text, text.length, text.length, [
          {trigger: '/', restrictToStart: true},
        ])
      ).toBeNull();
    }
  );

  it('matches a command at the start and permits unrestricted mentions later', () => {
    expect(
      findActiveTrigger('/new', 4, 4, [{trigger: '/', restrictToStart: true}])
    ).toEqual({trigger: '/', start: 0, end: 4, query: 'new'});
    expect(findActiveTrigger('hi @a', 5, 5, [{trigger: '@'}])).toEqual({
      trigger: '@',
      start: 3,
      end: 5,
      query: 'a',
    });
  });
});
