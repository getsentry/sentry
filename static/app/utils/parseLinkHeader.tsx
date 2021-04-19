export default function parseLinkHeader(
  header: string | null
): {[key: string]: {href: string; results: boolean | null; cursor: string}} {
  if (header === null || header === '') {
    return {};
  }

  const header_vals = header.split(',');
  const links = {};

  header_vals.forEach(val => {
    const match = /<([^>]+)>; rel="([^"]+)"(?:; results="([^"]+)")?(?:; cursor="([^"]+)")?/g.exec(
      val
    );
    const hasResults = match![3] === 'true' ? true : match![3] === 'false' ? false : null;

    links[match![2]] = {
      href: match![1],
      results: hasResults,
      cursor: match![4],
    };
  });

  return links;
}
