export type Meta = {
  fields: Record<string, string>;
  units: Record<string, string | null>;
};

export type Data = Record<string, number | string | undefined>[];
