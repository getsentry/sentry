import {Fuse} from 'sentry/utils/fuzzySearch';

type Options = {
  htmlString: string;
  key: string;
  markTags: {
    highlightPostTag: string;
    highlightPreTag: string;
  };
};

/**
 * Parses the "marked" html strings into a {key, value, indices} (mimincing the
 * FuseResultMatch type) object, where the indices are a set of zero indexed
 * [start, end] indices for what should be highlighted.
 *
 * @param key The key of the field, this mimics the Fuse match object
 * @param htmlString The html string to parse
 * @param markTags.highlightPreTag The left tag
 * @param markTags.highlightPostTag The right tag
 */
export default function parseHtmlMarks({key, htmlString, markTags}: Options) {
  const {highlightPreTag, highlightPostTag} = markTags;

  const indices: [number, number][] = [];
  let value = htmlString;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const openIndex = value.indexOf(highlightPreTag);
    const openIndexEnd = openIndex + highlightPreTag.length;
    if (openIndex === -1 || value.indexOf(highlightPostTag) === -1) {
      break;
    }
    value = value.slice(0, openIndex) + value.slice(openIndexEnd);

    const closeIndex = value.indexOf(highlightPostTag);
    const closeIndexEnd = closeIndex + highlightPostTag.length;
    value = value.slice(0, closeIndex) + value.slice(closeIndexEnd);

    indices.push([openIndex, closeIndex - 1]);
  }

  return {key, value, indices} as Fuse.FuseResultMatch;
}
