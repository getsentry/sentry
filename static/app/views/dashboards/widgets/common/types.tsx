export type Meta<FieldNames extends string[]> = {
  fields: {
    [Property in FieldNames[number]]: string;
  };
  units: {
    [Property in FieldNames[number]]: string;
  };
};

export type Data<FieldNames extends string[]> = {
  [Property in FieldNames[number]]: number | string | undefined;
}[];
