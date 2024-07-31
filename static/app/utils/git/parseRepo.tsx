export function parseRepo<T>(repo: T): T {
  if (typeof repo === 'string') {
    const re = /(?:github\.com|bitbucket\.org)\/([^\/]+\/[^\/]+)/i;
    const match = repo.match(re);
    const parsedRepo = match ? match[1] : repo;
    return parsedRepo as any;
  }

  return repo;
}
