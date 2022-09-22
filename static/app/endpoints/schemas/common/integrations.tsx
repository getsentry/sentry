import {z} from 'zod';

import {RepositoryStatus} from 'sentry/types/integrations';

export const repositoryStatusSchema = z.nativeEnum(RepositoryStatus);
