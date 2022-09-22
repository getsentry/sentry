import {z} from 'zod';

import {avatarSchema} from './common/core';
import {repositoryStatusSchema} from './common/integrations';
import {releaseStatusSchema} from './common/release';

const userSchema = z.object({
  email: z.string(),
  name: z.string(),
  id: z.string().optional(),
  ip_address: z.string().optional(),
  username: z.string().optional(),
  avatar: avatarSchema.optional(),
  avatarUrl: z.string().optional(),
  ip: z.string().optional(),
  ipAddress: z.string().optional(),
  lastSeen: z.string().optional(),
});

const deploySchema = z.object({
  dateFinished: z.string(),
  dateStarted: z.string().nullable(),
  environment: z.string(),
  id: z.string(),
  name: z.string(),
  url: z.string().nullable(),
});

const versionInfoSchema = z.object({
  buildHash: z.string().nullable(),
  description: z.string(),
  package: z.string().nullable(),
  version: z.object({
    raw: z.string(),
  }),
});

const baseReleaseSchema = z.object({
  dateCreated: z.string(),
  dateReleased: z.string().nullable(),
  ref: z.string().nullable(),
  shortVersion: z.string(),
  url: z.string().nullable(),
  version: z.string(),
});

const repositorySchema = z.object({
  dateCreated: z.string(),
  externalSlug: z.string(),
  id: z.string(),
  integrationId: z.string(),
  name: z.string(),
  provider: z.object({
    id: z.string(),
    name: z.string(),
  }),
  status: repositoryStatusSchema,
  url: z.string(),
});

const commitSchema = z.object({
  dateCreated: z.string(),
  id: z.string(),
  message: z.string().nullable(),
  releases: z.array(baseReleaseSchema),
  author: z.object({}).or(userSchema),
  repository: repositorySchema.optional(),
});

const releaseSchema = z.object({
  authors: z.array(userSchema),
  dateCreated: z.string(),
  dateReleased: z.string().nullable(),
  id: z.number(),
  ref: z.string().nullable(),
  shortVersion: z.string(),
  status: releaseStatusSchema,
  url: z.string().nullable(),
  version: z.string(),
  commitCount: z.number(),
  currentProjectMeta: z
    .object({
      firstReleaseVersion: z.string(),
      lastReleaseVersion: z.string(),
      nextReleaseVersion: z.string(),
      prevReleaseVersion: z.string(),
      sessionsLowerBound: z.string(),
      sessionsUpperBound: z.string(),
    })
    .partial(),
  deployCount: z.number(),
  firstEvent: z.string().nullable(),
  lastEvent: z.string().nullable(),
  newGroups: z.number(),
  versionInfo: versionInfoSchema,
  adoptionStages: z.record(z.object({adopted: z.string().nullable()})).optional(),
  lastCommit: commitSchema.nullable(),
  lastDeploy: deploySchema.nullable(),
  owner: z.any().optional(),
  projects: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      platform: z.string().nullable(),
      slug: z.string(),
    })
  ),
});

export const groupFirstLastReleaseSchema = z.object({
  id: z.string(),
  firstRelease: releaseSchema.nullable(),
  lastRelease: releaseSchema.nullable(),
});

export type GroupReleaseSchema = z.infer<typeof releaseSchema>;
export type GroupFirstLastReleaseSchema = z.infer<typeof groupFirstLastReleaseSchema>;
