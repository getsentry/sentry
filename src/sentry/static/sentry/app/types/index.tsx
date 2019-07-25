export type Organization = {
  id: string;
  slug: string;
  projects: Project[];
  access: string[];
};

export type Project = {
  id: string;
  slug: string;
  isMember: boolean;
};
