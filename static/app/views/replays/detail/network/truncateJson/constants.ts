export const OBJ = 10;
export const OBJ_KEY = 11;
export const OBJ_KEY_STR = 12;
export const OBJ_VAL = 13;
export const OBJ_VAL_STR = 14;
export const OBJ_VAL_COMPLETED = 15;

export const ARR = 20;
export const ARR_VAL = 21;
export const ARR_VAL_STR = 22;
export const ARR_VAL_COMPLETED = 23;

export type JsonToken =
  | typeof OBJ
  | typeof OBJ_KEY
  | typeof OBJ_KEY_STR
  | typeof OBJ_VAL
  | typeof OBJ_VAL_STR
  | typeof OBJ_VAL_COMPLETED
  | typeof ARR
  | typeof ARR_VAL
  | typeof ARR_VAL_STR
  | typeof ARR_VAL_COMPLETED;
