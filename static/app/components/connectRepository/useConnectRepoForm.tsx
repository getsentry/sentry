import {z} from 'zod';

import {defaultFormValidators, useScrapsForm} from '@sentry/scraps/form';

import type {PathMappingValue} from './type';

const schema = z.object({
  repository: z.string().nullable(),
  pathMappings: z.array(
    z.object({
      branch: z.string(),
      sourceRoot: z.string(),
      stackRoot: z.string(),
      automaticallyGenerated: z.boolean().optional(),
      hasCodeOwner: z.boolean().optional(),
      id: z.string().optional(),
    })
  ),
});

type Values = {pathMappings: PathMappingValue[]; repository: string | null};

export function useConnectRepoForm({
  defaultValues,
  onSubmit,
}: {
  defaultValues: Values;
  onSubmit?: (value: Values) => Promise<void> | void;
}) {
  return useScrapsForm({
    defaultValues,
    validators: defaultFormValidators(schema),
    onSubmit: ({value}) => onSubmit?.(value),
  });
}

export type ConnectRepoForm = ReturnType<typeof useConnectRepoForm>;
