const COUNT_OBJ = ({tag, topk}) => {
  let tagObject;

  if (tag === 'user') {
    const user = TestStubs.User();
    tagObject = {
      _health_id: `${tag}:${user.id}`,
      value: user,
    };
  } else if (tag === 'release') {
    const release = TestStubs.Release();
    tagObject = {
      _health_id: `${tag}:${release.slug}`,
      value: release,
    };
  } else {
    tagObject = {
      _health_id: `${tag}:${tag}-slug`,
      value: tag,
    };
  }

  return {
    count: 123,
    [tag]: tagObject,
    topProjects: topk ? [TestStubs.Project()] : [],
  };
};

const DEFAULT_QUERY = {tag: 'release'};
export function HealthTop(query = DEFAULT_QUERY, params) {
  const countObject = COUNT_OBJ(query);
  return {
    data: [countObject],
    totals: {
      count: 123,
      lastCount: 43,
    },
  };
}

export function HealthGraph(query = DEFAULT_QUERY, params) {
  const countObject = COUNT_OBJ(query);

  return {
    data: [
      [new Date(), [{...countObject, count: 321}, {...countObject, count: 79}]],
      [new Date(), [countObject]],
    ],
  };
}
