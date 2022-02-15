const REG_EXP = /(.*)\/([dgimsuy])/;

export const parseRegExp = (string: string): RegExpMatchArray | null => {
  return string.match(REG_EXP);
};

export const isRegExpString = (string?: string): boolean => {
  if (!string?.trim().length) {
    return false;
  }

  return REG_EXP.test(string);
};
