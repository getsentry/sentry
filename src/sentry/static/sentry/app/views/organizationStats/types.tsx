export type ProjectTotal = {
  id: string;
  accepted: number;
  blacklisted: number;
  received: number;
  rejected: number;
};

export type OrgTotal = ProjectTotal & {
  avgRate: number;
};

export type Point = {x: number; y: number[]};
