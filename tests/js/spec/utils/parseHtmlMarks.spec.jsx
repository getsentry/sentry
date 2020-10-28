import parseHtmlMarks from 'app/utils/parseHtmlMarks';

const MARK_TAGS = {
  highlightPreTag: '<mark>',
  highlightPostTag: '</mark>',
};

describe('parseHtmlMarks', function () {
  it('does nothing to a normal string', function () {
    const data = {
      key: 'title',
      htmlString: 'A string without any marking tags',
      markTags: MARK_TAGS,
    };

    expect(parseHtmlMarks(data)).toEqual({
      key: 'title',
      value: data.htmlString,
      indices: [],
    });
  });

  it('parses a marked html string', function () {
    const data = {
      key: 'title',
      htmlString: 'A string <mark>with</mark>out any <mark>marking</mark> tags',
      markTags: MARK_TAGS,
    };

    expect(parseHtmlMarks(data)).toEqual({
      key: 'title',
      value: 'A string without any marking tags',
      indices: [
        [9, 12],
        [21, 27],
      ],
    });
  });

  it('soft-fails on a invalid string', function () {
    const data = {
      key: 'title',
      htmlString: 'A string <mark>with</mark>out any <mark>marking tags',
      markTags: MARK_TAGS,
    };

    expect(parseHtmlMarks(data)).toEqual({
      key: 'title',
      value: 'A string without any <mark>marking tags',
      indices: [[9, 12]],
    });
  });
});
