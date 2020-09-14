function domId(prefix: string): string {
  return (
    prefix +
    Math.random()
      .toString(36)
      .substr(2, 10)
  );
}

export {domId};
