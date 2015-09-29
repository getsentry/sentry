import _ from "underscore";

/**
 * Converts a stream query to an object representation, with
 * keys representing tag names, and the magic __text key
 * representing the text component of the search.
 *
 * Example:
 *
 * "python is:unresolved assigned:foo@bar.com"
 * => {
 *      __text: "python",
 *      is: "unresolved",
 *      assigned: "foo@bar.com"
 *    }
 */

export function queryToObj(queryStr) {
	var text = [];

	let queryItems = queryStr.match(/\S+:"[^"]*"?|\S+/g);
	let queryObj = _.inject(queryItems, (obj, item) => {
	  let index = item.indexOf(':');
	  if (index === -1) {
	  	text.push(item);
	  } else {
		  let tagKey = item.slice(0, index);
		  let value = item.slice(index + 1).replace(/^"|"$/g, '');
		  obj[tagKey] = value;
	  }
	  return obj;
	}, {});

	if (text.length)
		queryObj.__text = text.join(' ');

	return queryObj;
}