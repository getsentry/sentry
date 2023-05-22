function domId(prefix: string): string {
  return prefix + Math.random().toString(36).substring(2, 12);
}

export default domId;
