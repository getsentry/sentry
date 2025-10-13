export type DistributiveOmit<
  TObject,
  TKey extends keyof TObject,
> = TObject extends unknown ? Omit<TObject, TKey> : never;
