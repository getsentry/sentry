const REG_EXP = /^\/(.*)\/([dgimsuy])?/;

export const parseRegExp = (string: string): RegExpMatchArray | null => {
  return string.match(REG_EXP);
};
