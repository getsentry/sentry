export type Meta = {
  fields: Record<string, string>;
  units: Record<string, string | null>;
};

export type TableData = Record<string, number | string | undefined>[];

export interface StateProps {
  error?: Error | string;
  isLoading?: boolean;
}
