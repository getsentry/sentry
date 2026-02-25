/**
 * Short deterministic hash from a string. Returns a compact base-36 ID
 * so prefixed SVG IDs stay short (e.g. "k7f2a-myId").
 * @param {string} str
 */
function shorthash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

/** @type {import('svgo').Config} */
const svgo = {
  multipass: true,
  plugins: [
    'preset-default',
    'cleanupIds',
    {
      name: 'prefixIds',
      params: {
        delim: '-',
        prefix: (_, info) => (info.path ? shorthash(info.path) : ''),
      },
    },
  ],
};

export default svgo;
