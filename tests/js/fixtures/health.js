const COUNT_OBJ = tag => ({
  count: 123,
  release: {
    _health_id: `${tag}:${tag}-slug`,
    value: {slug: `${tag}-slug`},
  },
});

export function Top(tag = 'release', params) {
  const countObject = COUNT_OBJ(tag);
  return {
    data: [countObject],
    totals: {
      count: 123,
      lastCount: 43,
    },
  };
}

export function Graph(tag = 'release', params) {
  const countObject = COUNT_OBJ(tag);

  return {
    data: [
      [new Date(), [{...countObject, count: 321}, {...countObject, count: 79}]],
      [new Date(), [countObject]],
    ],
  };
}
