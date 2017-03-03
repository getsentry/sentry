export default function(header) {
  if (header === null) {
    return {};
  }

  let header_vals = header.split(','), links = {};

  header_vals.forEach((val) => {
    let match = /<([^>]+)>; rel="([^"]+)"(?:; results="([^"]+)")?(?:; cursor="([^"]+)")?/g.exec(val);
    let hasResults = (match[3] === 'true' ? true : (match[3] === 'false' ? false : null));

    links[match[2]] = {
      href: match[1],
      results: hasResults,
      cursor: match[4]
    };
  });

  return links;
}

